begin;

create table public.event_assignments (
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role text not null check (role in ('organizer', 'co_organizer', 'coordinator', 'teacher', 'co_teacher')),
  primary key (event_id, person_id, role)
);
create index event_assignments_person_idx on public.event_assignments (person_id, event_id);
alter table public.event_assignments enable row level security;
revoke all on public.event_assignments from public, anon, authenticated;
grant select on public.event_assignments to authenticated;
grant select, insert, update, delete on public.event_assignments to service_role;
create policy event_assignments_own on public.event_assignments for select to authenticated
  using (public.is_teacher() and person_id = public.my_person_id());

-- Keep a native event's creator as its first event organizer.
create function public.teamup_record_event_organizer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source_system = 'teamup' and new.organizer_person_id is not null then
    insert into public.event_assignments (event_id, person_id, role)
    values (new.id, new.organizer_person_id, 'organizer');
  end if;
  return new;
end;
$$;
revoke all on function public.teamup_record_event_organizer() from public, anon, authenticated;
create trigger event_assignments_record_organizer after insert on public.events
  for each row execute function public.teamup_record_event_organizer();

insert into public.event_assignments (event_id, person_id, role)
select id, organizer_person_id, 'organizer' from public.events
where source_system = 'teamup' and organizer_person_id is not null;

-- The legacy name is used by matching, invitations and their RLS policies.
create or replace function public.owns_event(p_event_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_teacher() and exists (
    select 1 from public.events e where e.id = p_event_id
    and (e.organizer_user_id = auth.uid()
      or e.organizer_person_id = public.my_person_id()
      or exists (
        select 1 from public.event_assignments a
        where a.event_id = e.id and a.person_id = public.my_person_id()
          and a.role in ('organizer', 'co_organizer', 'coordinator')
      ))
  )
$$;

alter policy events_delete on public.events using (public.is_teacher() and organizer_user_id = auth.uid());

create function public.teamup_teacher_events(p_event_id uuid default null) returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'city', e.city, 'venue_name', e.venue_name,
    'description', e.description, 'starts_at', e.starts_at, 'timezone', e.timezone,
    'volunteers_needed', e.volunteers_needed, 'category', e.category,
    'required_skills', e.required_skills, 'status', e.status,
    'roles', assignments.roles, 'can_manage', access.can_manage,
    'invitations', case when access.can_manage then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'person_id', i.person_id, 'status', i.status,
        'people', case when p.id is not null then jsonb_build_object('full_name', p.full_name) end
      ) order by i.invited_at, i.id)
      from public.invitations i left join public.people p on p.id = i.person_id
      where i.event_id = e.id
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.events e
  cross join lateral (select public.owns_event(e.id) as can_manage) access
  cross join lateral (
    select coalesce(array_agg(a.role order by a.role), '{}'::text[]) as roles
    from public.event_assignments a where a.event_id = e.id and a.person_id = public.my_person_id()
  ) assignments
  where public.is_teacher() and (p_event_id is null or e.id = p_event_id)
    and (access.can_manage or cardinality(assignments.roles) > 0)
  order by e.starts_at desc nulls last, e.id
  limit 1000
$$;
revoke all on function public.teamup_teacher_events(uuid) from public, anon, authenticated;
grant execute on function public.teamup_teacher_events(uuid) to authenticated;

-- Resolve assignment inputs through the same identifiers used by the existing seed.
create function public.teamup_import_event_assignments(p_assignments jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  supplied integer;
  matched integer;
  added integer;
begin
  with source_rows as (
    select * from jsonb_to_recordset(p_assignments)
      as r(source_system text, event_source_id text, source_table text, person_external_id text, role text)
  ), resolved as (
    select e.id as event_id, ps.person_id, r.role
    from source_rows r
    join public.events e on e.source_system = r.source_system and e.source_id = r.event_source_id
    join public.person_sources ps on ps.source_system = r.source_system
      and ps.source_table = r.source_table and ps.external_id = r.person_external_id
    where (r.source_system, r.source_table) in (
      ('harmony', 'harmony_program_people'), ('retreat_guru', 'retreat_guru_teachers')
    )
  ), inserted as (
    insert into public.event_assignments (event_id, person_id, role)
    select distinct event_id, person_id, role from resolved
    on conflict do nothing returning 1
  )
  select (select count(*) from source_rows), (select count(*) from resolved), (select count(*) from inserted)
    into supplied, matched, added;
  if supplied <> matched then raise exception 'Matched % of % event assignments.', matched, supplied; end if;
  return added;
end;
$$;
revoke all on function public.teamup_import_event_assignments(jsonb) from public, anon, authenticated;
grant execute on function public.teamup_import_event_assignments(jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
