begin;

alter table public.invitations
  add column request_source text not null default 'teacher_invitation'
    check (request_source in ('teacher_invitation', 'volunteer_application')),
  add column requested_role text;

create table public.event_favorites (
  account_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, event_id)
);

alter table public.event_favorites enable row level security;
revoke all on public.event_favorites from public, anon, authenticated;
grant select, insert, delete on public.event_favorites to authenticated;
grant select, insert, update, delete on public.event_favorites to service_role;

create policy event_favorites_own_read on public.event_favorites
  for select to authenticated using (account_id = auth.uid());
create policy event_favorites_own_add on public.event_favorites
  for insert to authenticated with check (
    account_id = auth.uid() and exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'scheduled' and e.starts_at > now()
        and e.category is distinct from 'priority'
    )
  );
create policy event_favorites_own_remove on public.event_favorites
  for delete to authenticated using (account_id = auth.uid());

create function public.teamup_browse_opportunities(
  p_query text default null,
  p_skill text default null,
  p_city text default null,
  p_starts_before timestamptz default null,
  p_event_id uuid default null,
  p_limit integer default 24,
  p_offset integer default 0
) returns setof jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'description', e.description,
    'city', e.city,
    'venue_name', e.venue_name,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'timezone', e.timezone,
    'category', e.category,
    'required_skills', coalesce(e.required_skills, '{}'::text[]),
    'volunteers_needed', e.volunteers_needed,
    'confirmed_count', stats.confirmed_count,
    'spots_left', greatest(0, e.volunteers_needed - stats.confirmed_count),
    'is_favorite', favorite.event_id is not null,
    'invitation_status', invitation.status,
    'request_source', invitation.request_source,
    'requested_role', invitation.requested_role
  )
  from public.events e
  cross join lateral (
    select count(*)::integer as confirmed_count
    from public.invitations i where i.event_id = e.id and i.status = 'accepted'
  ) stats
  left join public.event_favorites favorite
    on favorite.event_id = e.id and favorite.account_id = auth.uid()
  left join public.invitations invitation
    on invitation.event_id = e.id and invitation.person_id = public.my_person_id()
  where exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.account_role = 'volunteer'
  )
    and e.status = 'scheduled'
    and e.starts_at > now()
    and e.category is distinct from 'priority'
    and e.volunteers_needed > stats.confirmed_count
    and (p_event_id is null or e.id = p_event_id)
    and (nullif(btrim(p_skill), '') is null or p_skill = any(coalesce(e.required_skills, '{}'::text[])))
    and (nullif(btrim(p_city), '') is null or e.city ilike '%' || btrim(p_city) || '%')
    and (p_starts_before is null or e.starts_at < p_starts_before)
    and (
      nullif(btrim(p_query), '') is null
      or concat_ws(' ', e.title, e.description, e.city, e.venue_name,
        array_to_string(coalesce(e.required_skills, '{}'::text[]), ' ')) ilike '%' || btrim(p_query) || '%'
    )
  order by e.starts_at, e.id
  limit greatest(1, least(coalesce(p_limit, 24), 50))
  offset greatest(0, coalesce(p_offset, 0))
$$;

create function public.teamup_apply_to_event(p_event_id uuid, p_requested_role text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  viewer_person uuid := public.my_person_id();
  clean_role text := nullif(btrim(p_requested_role), '');
  application_id uuid;
  event_skills text[];
begin
  if viewer_person is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.account_role = 'volunteer'
  ) then return null; end if;

  select coalesce(e.required_skills, '{}'::text[]) into event_skills
  from public.events e
  where e.id = p_event_id and e.status = 'scheduled' and e.starts_at > now()
    and e.category is distinct from 'priority'
    and e.volunteers_needed > (
      select count(*) from public.invitations i where i.event_id = e.id and i.status = 'accepted'
    )
  for share;
  if not found then return null; end if;

  if cardinality(event_skills) > 0 and (clean_role is null or not clean_role = any(event_skills)) then
    raise exception 'Choose one of the skills needed for this event.';
  end if;
  if cardinality(event_skills) = 0 then clean_role := coalesce(clean_role, 'General support'); end if;
  if length(clean_role) > 100 then raise exception 'Choose a shorter role.'; end if;

  insert into public.invitations (
    event_id, person_id, status, invited_by, invited_at, responded_at, request_source, requested_role
  ) values (
    p_event_id, viewer_person, 'pending', auth.uid(), now(), null, 'volunteer_application', clean_role
  )
  on conflict (event_id, person_id) do update set
    status = 'pending', invited_by = auth.uid(), invited_at = now(), responded_at = null,
    request_source = 'volunteer_application', requested_role = excluded.requested_role
  where invitations.status = 'declined'
  returning id into application_id;
  return application_id;
end;
$$;

create function public.teamup_cancel_application(p_invitation_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  update public.invitations i set status = 'declined', responded_at = now()
  where i.id = p_invitation_id and i.person_id = public.my_person_id()
    and i.request_source = 'volunteer_application' and i.status = 'pending'
  returning true
$$;

create function public.teamup_review_application(p_invitation_id uuid, p_response text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  application public.invitations%rowtype;
begin
  if p_response not in ('accepted', 'declined') then return false; end if;
  select i.* into application from public.invitations i
  where i.id = p_invitation_id and i.request_source = 'volunteer_application' and i.status = 'pending'
    and public.owns_event(i.event_id)
  for update;
  if not found then return false; end if;

  if p_response = 'accepted' then
    perform 1 from public.events e
    where e.id = application.event_id and e.status = 'scheduled' and e.starts_at > now()
      and e.volunteers_needed > (
        select count(*) from public.invitations i where i.event_id = e.id and i.status = 'accepted'
      )
    for update;
    if not found then return false; end if;
  end if;

  update public.invitations set status = p_response, responded_at = now()
  where id = application.id;
  return true;
end;
$$;

-- A volunteer can respond only to a teacher-originated invitation. Applications
-- are reviewed by an event manager and cannot be self-approved.
create or replace function public.teamup_reply_to_invitation(p_invitation_id uuid, p_response text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  viewer_person uuid := public.my_person_id();
begin
  if coalesce(p_response, '') not in ('accepted', 'declined') then raise exception 'Choose accept or decline.'; end if;
  perform 1 from public.events e join public.invitations i on i.event_id = e.id
    where i.id = p_invitation_id and i.person_id = viewer_person
      and i.request_source = 'teacher_invitation'
      and e.status = 'scheduled' and e.starts_at > now()
    for share of e;
  if not found then return false; end if;
  update public.invitations i set status = p_response, responded_at = now()
    where i.id = p_invitation_id and i.person_id = viewer_person and i.status = 'pending'
      and i.request_source = 'teacher_invitation';
  return found;
end;
$$;

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
        'request_source', i.request_source, 'requested_role', i.requested_role,
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

create function public.teamup_favorite_event(p_event_id uuid, p_favorite boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.account_role = 'volunteer'
  ) then return false; end if;

  if coalesce(p_favorite, false) then
    if not exists (
      select 1 from public.events e
      where e.id = p_event_id and e.status = 'scheduled' and e.starts_at > now()
        and e.category is distinct from 'priority'
    ) then return false; end if;
    insert into public.event_favorites (account_id, event_id)
    values (auth.uid(), p_event_id) on conflict do nothing;
    return true;
  end if;

  delete from public.event_favorites
  where account_id = auth.uid() and event_id = p_event_id;
  return true;
end;
$$;

revoke all on function public.teamup_browse_opportunities(text,text,text,timestamptz,uuid,integer,integer),
  public.teamup_favorite_event(uuid,boolean), public.teamup_apply_to_event(uuid,text),
  public.teamup_cancel_application(uuid), public.teamup_review_application(uuid,text)
  from public, anon, authenticated;
grant execute on function public.teamup_browse_opportunities(text,text,text,timestamptz,uuid,integer,integer),
  public.teamup_favorite_event(uuid,boolean), public.teamup_apply_to_event(uuid,text),
  public.teamup_cancel_application(uuid), public.teamup_review_application(uuid,text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
