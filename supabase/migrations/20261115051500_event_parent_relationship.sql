begin;

alter table public.events add column parent_event_id uuid;
alter table public.events add constraint events_parent_event_fk
  foreign key (parent_event_id) references public.events(id) on delete set null;
alter table public.events add constraint events_parent_event_not_self
  check (parent_event_id is null or parent_event_id <> id);
create index events_parent_event_idx on public.events (parent_event_id)
  where parent_event_id is not null;

-- Related seva may be nested one level deep and each parent may have at most
-- five children. The advisory lock also protects the capacity check when two
-- children are created at the same time.
create function public.teamup_enforce_event_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  parent_parent_id uuid;
  child_count integer;
begin
  if new.parent_event_id is null then
    return new;
  end if;

  if new.parent_event_id = new.id then
    raise exception 'An event cannot be related to itself.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.parent_event_id::text, 0));

  select e.parent_event_id into parent_parent_id
  from public.events e where e.id = new.parent_event_id;
  if not found then
    raise exception 'The parent event does not exist.';
  end if;
  if parent_parent_id is not null then
    raise exception 'Related seva cannot be nested more than one level.';
  end if;
  if exists (
    select 1 from public.events child
    where child.parent_event_id = new.id and child.id <> new.id
  ) then
    raise exception 'An event with related seva cannot become a child event.';
  end if;
  if auth.uid() is not null and not public.owns_event(new.parent_event_id) then
    raise exception 'Only a manager of the parent event can add related seva.';
  end if;

  select count(*) into child_count
  from public.events child
  where child.parent_event_id = new.parent_event_id and child.id <> new.id;
  if child_count >= 5 then
    raise exception 'An event can have at most five related seva events.';
  end if;

  return new;
end;
$$;
revoke all on function public.teamup_enforce_event_parent() from public, anon, authenticated;
create trigger events_enforce_parent before insert or update of parent_event_id on public.events
  for each row execute function public.teamup_enforce_event_parent();

create or replace function public.teamup_teacher_events(p_event_id uuid default null) returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'city', e.city, 'venue_name', e.venue_name,
    'description', e.description, 'starts_at', e.starts_at, 'timezone', e.timezone,
    'volunteers_needed', e.volunteers_needed, 'category', e.category,
    'required_skills', e.required_skills, 'status', e.status,
    'parent_event_id', e.parent_event_id, 'parent_title', parent.title,
    'child_count', (select count(*) from public.events child where child.parent_event_id = e.id),
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
  left join public.events parent on parent.id = e.parent_event_id
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

create or replace function public.teamup_event_circle(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.can_access_event_circle(p_event_id) then (
    select jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'description', e.description,
      'city', e.city,
      'venue_name', e.venue_name,
      'starts_at', e.starts_at,
      'ends_at', e.ends_at,
      'timezone', e.timezone,
      'volunteers_needed', e.volunteers_needed,
      'category', e.category,
      'status', e.status,
      'can_manage', public.owns_event(e.id),
      'parent_event_id', e.parent_event_id,
      'parent_event_title', parent.title,
      'parent_can_access', case when parent.id is null then false else public.can_access_event_circle(parent.id) end,
      'confirmed_count', (
        select count(*) from public.invitations i
        where i.event_id = e.id and i.status = 'accepted'
      ),
      'my_invitation_status', (
        select i.status from public.invitations i
        where i.event_id = e.id and i.person_id = public.my_person_id()
      ),
      'related_events', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', child.id,
          'title', child.title,
          'city', child.city,
          'starts_at', child.starts_at,
          'timezone', child.timezone,
          'status', child.status,
          'volunteers_needed', child.volunteers_needed,
          'confirmed_count', (
            select count(*) from public.invitations i
            where i.event_id = child.id and i.status = 'accepted'
          ),
          'can_access', public.can_access_event_circle(child.id)
        ) order by child.starts_at nulls last, child.id)
        from public.events child where child.parent_event_id = e.id
      ), '[]'::jsonb)
    )
    from public.events e
    left join public.events parent on parent.id = e.parent_event_id
    where e.id = p_event_id
  ) end
$$;

notify pgrst, 'reload schema';
commit;
