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
       pr.seva_photo is not null as has_photo
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

create function public.teamup_volunteer_photo(p_person_id uuid) returns bytea
language sql stable security definer set search_path = '' as $$
  select p.seva_photo
  from public.profiles p
  join public.volunteer_profiles v on v.person_id = p.person_id
  where public.is_teacher() and p.person_id = p_person_id
$$;
revoke all on function public.teamup_volunteer_photo(uuid) from public, anon, authenticated;
grant execute on function public.teamup_volunteer_photo(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
