begin;

-- The About You form already collects the complete first-login profile. Save it
-- atomically and mark both focused edit sections as reviewed so new users do not
-- have to enter the same skills and availability a second time.
create function public.teamup_complete_seva_profile(
  preferences jsonb,
  photo_base64 text default null,
  remove_photo boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  saved_profile jsonb;
begin
  if preferences is null then
    raise exception 'Profile preferences are required.';
  end if;

  saved_profile := public.teamup_seva_profile(preferences, photo_base64, remove_photo);
  if saved_profile is null then return null; end if;

  update public.profiles p set
    seva_skills_reviewed_at = coalesce(p.seva_skills_reviewed_at, now()),
    seva_availability_reviewed_at = coalesce(p.seva_availability_reviewed_at, now())
  where p.id = viewer;

  return saved_profile || jsonb_build_object(
    'skills_reviewed', true,
    'availability_reviewed', true
  );
end;
$$;

revoke all on function public.teamup_complete_seva_profile(jsonb, text, boolean)
  from public, anon, authenticated;
grant execute on function public.teamup_complete_seva_profile(jsonb, text, boolean)
  to authenticated;

notify pgrst, 'reload schema';

commit;
