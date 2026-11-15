begin;

create or replace view public.volunteer_directory with (security_barrier = true) as
select p.id as person_id, p.full_name, p.city, p.timezone,
       p.last_course, p.last_course_date, p.courses_count,
       v.skills, v.emergency_seva, v.is_simulated as skills_simulated,
       v.interests,
       concat_ws(' | ', p.full_name, array_to_string(v.skills, ' | '), array_to_string(v.interests, ' | ')) as search_text,
       case
         when prefs.patterns ? 'Flexible' or exists (
           select 1 from public.availability a
           where a.person_id = p.id and (not a.is_simulated or v.is_simulated)
         ) then 'available'
         when prefs.patterns ?| array['Weekdays', 'Weekends', 'Evenings'] or exists (
           select 1 from jsonb_array_elements_text(prefs.dates) as dates(day)
           where day >= to_char(current_date, 'YYYY-MM-DD')
         ) then 'limited'
         else 'unknown'
       end as availability_status,
       pr.seva_photo is not null as has_photo,
       case
         when jsonb_typeof(prefs.patterns) = 'array' and jsonb_array_length(prefs.patterns) > 0 then
           array(select value from jsonb_array_elements_text(prefs.patterns) choices(value))
         else array_remove(array[
           case when exists (select 1 from public.availability a where a.person_id = p.id and a.day_of_week between 1 and 5) then 'Weekdays' end,
           case when exists (select 1 from public.availability a where a.person_id = p.id and a.day_of_week in (0, 6)) then 'Weekends' end,
           case when exists (select 1 from public.availability a where a.person_id = p.id and a.start_time >= time '17:00') then 'Evenings' end
         ], null)
       end as availability_patterns,
       (
         select count(*)::integer
         from public.invitations i
         join public.events e on e.id = i.event_id
         where i.person_id = p.id and i.status = 'accepted'
           and (e.status = 'completed' or e.ends_at < now())
       ) as past_seva_count
from public.people p
join public.volunteer_profiles v on v.person_id = p.id
left join public.profiles pr on pr.person_id = p.id
cross join lateral (
  select coalesce(pr.seva_preferences -> 'availability', '[]'::jsonb) as patterns,
         coalesce(pr.seva_preferences -> 'dates', '[]'::jsonb) as dates
) prefs
where public.is_teacher();

revoke all on public.volunteer_directory from public, anon, authenticated;
grant select on public.volunteer_directory to authenticated;

notify pgrst, 'reload schema';
commit;
