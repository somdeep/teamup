begin;

alter table public.profiles add column seva_availability_reviewed_at timestamptz;

create function public.teamup_availability_profile(availability_preferences jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  account public.profiles%rowtype;
  saved_profile jsonb;
  reviewed boolean;
begin
  if availability_preferences is null then
    saved_profile := public.teamup_skills_profile();
    select p.seva_availability_reviewed_at is not null into reviewed from public.profiles p where p.id = viewer;
  else
    select * into account from public.profiles p
    where p.id = viewer and p.seva_preferences is not null and p.seva_skills_reviewed_at is not null
    for update;
    if not found then return null; end if;

    -- Use the latest profile values and change only the requested selections.
    saved_profile := public.teamup_seva_profile(account.seva_preferences || jsonb_build_object(
      'intent', account.signup_intent,
      'skills', account.signup_skills,
      'availability', availability_preferences->'availability',
      'dates', availability_preferences->'dates',
      'emergency', availability_preferences->'emergency'
    ));
    if saved_profile is not null then
      update public.profiles p set seva_availability_reviewed_at = now() where p.id = viewer;
      saved_profile := saved_profile || jsonb_build_object('skills_reviewed', true);
      reviewed := true;
    end if;
  end if;

  return saved_profile || jsonb_build_object('availability_reviewed', coalesce(reviewed, false));
end;
$$;

revoke all on function public.teamup_availability_profile(jsonb) from public, anon, authenticated;
grant execute on function public.teamup_availability_profile(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
