begin;

-- Return only the names of teachers assigned to an event. Volunteers can see
-- them for open opportunities or circles they have joined; teachers can see
-- them for circles to which they are assigned.
create function public.teamup_event_organizer_names(p_event_id uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  with allowed as (
    select public.can_access_event_circle(p_event_id)
      or exists (
        select 1
        from public.profiles pr
        join public.events e on e.id = p_event_id
        where pr.id = auth.uid() and pr.account_role = 'volunteer'
          and e.status = 'scheduled' and e.starts_at > now()
          and e.category is distinct from 'priority'
      ) as yes
  ), assigned as (
    select e.organizer_person_id as person_id
    from public.events e where e.id = p_event_id and e.organizer_person_id is not null
    union
    select a.person_id from public.event_assignments a
    where a.event_id = p_event_id
      and a.role in ('organizer', 'co_organizer', 'coordinator', 'teacher', 'co_teacher')
  )
  select case when (select yes from allowed)
    then coalesce(array_agg(distinct p.full_name order by p.full_name), '{}'::text[])
    else '{}'::text[] end
  from assigned a join public.people p on p.id = a.person_id
$$;

revoke all on function public.teamup_event_organizer_names(uuid) from public, anon, authenticated;
grant execute on function public.teamup_event_organizer_names(uuid) to authenticated;

create or replace function public.teamup_browse_opportunities(
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
    'organizer_names', public.teamup_event_organizer_names(e.id),
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
      'organizer_names', public.teamup_event_organizer_names(e.id),
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
