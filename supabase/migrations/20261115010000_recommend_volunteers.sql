begin;

-- Volunteer recommender for an organizer's event.
--
-- Returns volunteers who
--   1. are free for the event, using either
--        - the onboarding choices in profiles.seva_preferences
--          (Weekdays / Weekends / Evenings / Flexible / Specific Dates), or
--        - a weekly slot in public.availability that covers the event time;
--   2. have at least one of the event's required_skills
--      (if the event lists no skills, every available volunteer qualifies).
-- Ranked by how many required skills they cover, then same city, then name.
-- Organizers only; no email or phone returned (same rules as match_volunteers).

create or replace function public.recommend_volunteers(p_event_id uuid, p_limit int default 50)
returns table (
  person_id uuid,
  full_name text,
  city text,
  skills text[],
  matched_skills text[],
  matched_count int,
  required_count int,
  same_city boolean,
  emergency_seva boolean,
  reasons text[],
  invitation_status text
)
language sql stable security definer set search_path = public
as $$
  with ev as (
    select e.id, e.city, e.required_skills,
           e.starts_local,
           e.starts_local::date as ev_date,
           extract(dow from e.starts_local)::int as dow,            -- 0 = Sunday ... 6 = Saturday
           e.starts_local::time as s_start,
           case when e.ends_local::date = e.starts_local::date then e.ends_local::time
                else coalesce((e.schedule -> 0 ->> 'end')::time, e.ends_local::time) end as s_end
    from public.events e
    where e.id = p_event_id and public.is_organizer()
  ), cand as (
    select p.id as pid, p.full_name as pname, p.city as pcity,
           v.skills as vskills, v.emergency_seva as emergency,
           array(select unnest(v.skills) intersect select unnest(ev.required_skills) order by 1) as matched,
           cardinality(ev.required_skills) as req_n,
           (ev.city = 'Online' or lower(p.city) = lower(ev.city)) as near,
           coalesce(pr.seva_preferences -> 'availability', '[]'::jsonb) as pref,
           coalesce(pr.seva_preferences -> 'dates', '[]'::jsonb) as pref_dates,
           exists (select 1 from public.availability a
                   where a.person_id = p.id and a.day_of_week = ev.dow
                     and a.start_time <= ev.s_start and a.end_time >= ev.s_end) as slot_free,
           ev.dow, ev.s_start, ev.ev_date, ev.starts_local
    from ev
    cross join public.people p
    join public.volunteer_profiles v on v.person_id = p.id
    left join public.profiles pr on pr.person_id = p.id
  ), scored as (
    select c.*,
           case
             when c.pref ? 'Flexible'                                                    then 'Flexible schedule'
             when c.dow in (0, 6) and c.pref ? 'Weekends'                                then 'Free on weekends'
             when c.dow between 1 and 5 and c.pref ? 'Weekdays'                          then 'Free on weekdays'
             when c.s_start >= time '17:00' and c.pref ? 'Evenings'                      then 'Free in the evenings'
             when c.pref ? 'Specific Dates' and c.pref_dates ? to_char(c.ev_date, 'YYYY-MM-DD')
                                                                                         then 'Free on this date'
             when c.slot_free then 'Free on ' || to_char(c.starts_local, 'FMDay') || 's at this time'
           end as avail_reason
    from cand c
  )
  select s.pid, s.pname, s.pcity, s.vskills, s.matched,
         cardinality(s.matched), s.req_n, coalesce(s.near, false), s.emergency,
         array_remove(array[
           case when cardinality(s.matched) > 0
                then 'Skills: ' || array_to_string(s.matched, ', ')
                     || ' (' || cardinality(s.matched) || ' of ' || s.req_n || ')' end,
           s.avail_reason,
           case when s.near then 'Based in ' || s.pcity end,
           case when s.emergency then 'Open to last-minute seva' end
         ], null),
         i.status
  from scored s
  left join public.invitations i on i.event_id = p_event_id and i.person_id = s.pid
  where s.avail_reason is not null
    and (s.req_n = 0 or cardinality(s.matched) > 0)
  order by cardinality(s.matched) desc, coalesce(s.near, false) desc, s.pname
  limit p_limit
$$;

revoke all on function public.recommend_volunteers(uuid, int) from public, anon;
grant execute on function public.recommend_volunteers(uuid, int) to authenticated;

notify pgrst, 'reload schema';

commit;
