begin;

-- Teachers can reach volunteers directly from the teacher-only directory profile.
-- Keep phone numbers out of directory queries and expose them only through this
-- narrowly scoped RPC after the database confirms the viewer is a Teacher.
create or replace function public.teamup_volunteer_phone(p_person_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(p.phone), '')
  from public.people p
  join public.volunteer_profiles v on v.person_id = p.id
  where public.is_teacher()
    and p.id = p_person_id
$$;

revoke all on function public.teamup_volunteer_phone(uuid) from public, anon, authenticated;
grant execute on function public.teamup_volunteer_phone(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
