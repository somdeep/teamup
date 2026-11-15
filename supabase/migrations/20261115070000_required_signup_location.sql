begin;

-- Extend the existing signup transaction without duplicating its identity,
-- teacher-claim, skills, and profile-linking rules.
create function public.teamup_signup_profile_with_location(profile jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  candidate jsonb;
  saved_profile jsonb;
  submitted_location text;
  linked_person uuid;
  profile_complete boolean;
  existing_location text;
begin
  select p.signup_intent is not null, p.person_id, person.city
    into profile_complete, linked_person, existing_location
  from public.profiles p
  left join public.people person on person.id = p.person_id
  where p.id = viewer;

  select coalesce(profile, u.raw_user_meta_data->'teamup_pending_profile')
    into candidate
  from auth.users u
  where u.id = viewer and u.email_confirmed_at is not null;
  if not found then raise exception 'A verified account is required.'; end if;

  submitted_location := btrim(candidate->>'location');
  if not coalesce(profile_complete, false)
      and (submitted_location is null or submitted_location = '' or length(submitted_location) > 100) then
    raise exception 'Enter your city or area.';
  end if;
  if submitted_location is not null and (submitted_location = '' or length(submitted_location) > 100) then
    raise exception 'Enter your city or area.';
  end if;

  saved_profile := public.teamup_signup_profile(profile);
  if saved_profile is null then return null; end if;

  select p.person_id into linked_person from public.profiles p where p.id = viewer;
  if submitted_location is not null then
    update public.people set city = submitted_location where id = linked_person;
    existing_location := submitted_location;
  end if;

  return saved_profile || jsonb_build_object('location', existing_location);
end;
$$;

revoke all on function public.teamup_signup_profile_with_location(jsonb)
  from public, anon, authenticated;
grant execute on function public.teamup_signup_profile_with_location(jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;
