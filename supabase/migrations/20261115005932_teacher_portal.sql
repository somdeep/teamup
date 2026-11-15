begin;

alter policy events_insert on public.events with check (
  public.is_organizer() and organizer_user_id = auth.uid()
  and (organizer_person_id is null or organizer_person_id = public.my_person_id())
  and source_system = 'teamup' and status = 'scheduled'
);
revoke update on public.events from public, anon, authenticated;
grant update (title, description, category, status, city, venue_name, starts_local, ends_local,
              timezone, schedule, required_skills, volunteers_needed) on public.events to authenticated;

create or replace function public.match_volunteers(
  p_event_id uuid, p_limit int default 50, p_include_unavailable boolean default false
) returns table (
  person_id uuid, full_name text, city text, skills text[], matched_skills text[],
  available boolean, same_city boolean, score numeric, reasons text[], invitation_status text
)
language sql stable security definer set search_path = '' as $$
  with owned as materialized (
    select e.id, e.starts_at, e.ends_at, e.city, e.category, e.required_skills
    from public.events e where e.id = p_event_id and public.owns_event(e.id)
      and e.status = 'scheduled' and isfinite(e.starts_at) and isfinite(e.ends_at)
      and e.starts_at > now() and e.ends_at > e.starts_at
  ), coverage as (
    select a.person_id, range_agg(tstzrange(slot.starts_at, slot.ends_at, '[)')) as periods
    from owned e
    cross join public.availability a
    join pg_catalog.pg_timezone_names zone on zone.name = a.timezone
    cross join lateral (
      select (e.starts_at at time zone zone.name)::date as first_day,
             (e.ends_at at time zone zone.name)::date as last_day
    ) days
    cross join lateral generate_series(0, days.last_day - days.first_day) offsets(day_offset)
    cross join lateral (select days.first_day + offsets.day_offset as local_day) day
    cross join lateral (
      select (day.local_day + a.start_time) at time zone zone.name as starts_at,
             (day.local_day + a.end_time) at time zone zone.name as ends_at
    ) slot
    where extract(dow from day.local_day) = a.day_of_week and slot.starts_at < slot.ends_at
      and slot.starts_at < e.ends_at and slot.ends_at > e.starts_at
    group by a.person_id
  ), candidates as (
    select p.id, p.full_name, p.city, v.skills, v.emergency_seva, e.category,
      array(select unnest(v.skills) intersect select unnest(e.required_skills) order by 1) as matched,
      coalesce(c.periods @> tstzrange(e.starts_at,e.ends_at,'[)'), false) as available,
      coalesce(e.city = 'Online' or lower(p.city) = lower(e.city), false) as same_city,
      cardinality(e.required_skills) as required_count, i.status as invitation_status
    from owned e
    cross join public.volunteer_profiles v
    join public.people p on p.id = v.person_id
    left join coverage c on c.person_id = p.id
    left join public.invitations i on i.event_id = e.id and i.person_id = p.id
    where p.id is distinct from public.my_person_id()
  )
  select c.id, c.full_name, c.city, c.skills, c.matched, c.available, c.same_city,
    round(coalesce(50.0 * cardinality(c.matched) / nullif(c.required_count, 0), 50)
      + case when c.available then 35 else 0 end + case when c.same_city then 15 else 0 end, 1) as score,
    array_remove(array[
      case when cardinality(c.matched) > 0 then 'Skills: ' || array_to_string(c.matched, ', ') end,
      case when c.available then 'Available for the full event' end,
      case when c.same_city and c.city is not null then 'Based in ' || c.city end,
      case when c.emergency_seva then 'Open to last-minute seva' end
    ], null), c.invitation_status
  from candidates c
  where c.available or p_include_unavailable
  order by (coalesce(c.category = 'priority', false) and c.emergency_seva) desc, score desc, c.full_name, c.id
  limit greatest(1, least(coalesce(p_limit, 50), 100))
$$;

create function public.teamup_invite(p_event_id uuid, p_person_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_event(p_event_id) then raise exception 'You can only invite to your own events.'; end if;
  perform 1 from public.events e where e.id = p_event_id and e.status = 'scheduled' and e.starts_at > now() for share;
  if not found then raise exception 'This event is closed to invitations.'; end if;
  if p_person_id is not distinct from public.my_person_id() or not exists (
    select 1 from public.volunteer_profiles v where v.person_id = p_person_id
  ) then raise exception 'Choose a volunteer from the directory.'; end if;
  insert into public.invitations (event_id, person_id, invited_by)
  values (p_event_id, p_person_id, auth.uid()) on conflict (event_id, person_id) do nothing;
  return found;
end;
$$;

create function public.teamup_reply_to_invitation(p_invitation_id uuid, p_response text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  viewer_person uuid := public.my_person_id();
begin
  if coalesce(p_response, '') not in ('accepted', 'declined') then raise exception 'Choose accept or decline.'; end if;
  perform 1 from public.events e join public.invitations i on i.event_id = e.id
    where i.id = p_invitation_id and i.person_id = viewer_person and e.status = 'scheduled' and e.starts_at > now()
    for share of e;
  if not found then return false; end if;
  update public.invitations i set status = p_response
    where i.id = p_invitation_id and i.person_id = viewer_person and i.status = 'pending';
  return found;
end;
$$;

revoke insert on public.invitations from public, anon, authenticated;
revoke update (status) on public.invitations from public, anon, authenticated;
revoke all on function public.match_volunteers(uuid,int,boolean), public.teamup_invite(uuid,uuid),
  public.teamup_reply_to_invitation(uuid,text) from public, anon, authenticated;
grant execute on function public.match_volunteers(uuid,int,boolean), public.teamup_invite(uuid,uuid),
  public.teamup_reply_to_invitation(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
