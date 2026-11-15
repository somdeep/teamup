begin;

alter table public.profiles
  add column seva_preferences jsonb,
  add column seva_photo bytea check (octet_length(seva_photo) <= 196608);

create function public.teamup_seva_profile(
  preferences jsonb default null,
  photo_base64 text default null,
  remove_photo boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  account public.profiles%rowtype;
  saved_profile jsonb;
  intent text;
  chosen_skills text[];
  chosen_interests text[];
  chosen_availability text[];
  chosen_dates text[];
  emergency boolean;
  photo bytea;
  allowed_skills constant text[] := array[
    'Community Outreach', 'Decor', 'Driving', 'Greeting & hospitality', 'Kids activities', 'Kitchen seva',
    'Music & bhajans', 'Photography', 'Registration desk', 'Setup & logistics', 'Social media', 'Teaching',
    'Tech & AV', 'Translation'
  ];
begin
  if not exists (select 1 from auth.users u where u.id = viewer and u.email_confirmed_at is not null) then
    raise exception 'A verified account is required.';
  end if;

  if preferences is not null then
    select * into account from public.profiles p where p.id = viewer and p.signup_intent is not null for update;
    if not found then return null; end if;

    intent := preferences->>'intent';
    if coalesce(intent, '') not in ('Teacher', 'Volunteer')
        or jsonb_typeof(preferences->'skills') is distinct from 'array'
        or jsonb_typeof(preferences->'interests') is distinct from 'array'
        or jsonb_typeof(preferences->'availability') is distinct from 'array'
        or jsonb_typeof(preferences->'dates') is distinct from 'array'
        or jsonb_typeof(preferences->'emergency') is distinct from 'boolean' then
      raise exception 'Enter valid seva preferences.';
    end if;

    chosen_skills := array(select distinct value from jsonb_array_elements_text(preferences->'skills') order by value);
    chosen_interests := array(select distinct value from jsonb_array_elements_text(preferences->'interests') order by value);
    chosen_availability := array(select distinct value from jsonb_array_elements_text(preferences->'availability') order by value);
    chosen_dates := array(select distinct value from jsonb_array_elements_text(preferences->'dates') order by value);
    emergency := (preferences->>'emergency')::boolean;

    if not (chosen_skills <@ allowed_skills and chosen_interests <@ allowed_skills)
        or not chosen_availability <@ array['Weekdays', 'Weekends', 'Evenings', 'Flexible', 'Specific Dates']
        or cardinality(chosen_dates) > 20
        or (('Specific Dates' = any(chosen_availability)) <> (cardinality(chosen_dates) > 0))
        or exists (select 1 from unnest(chosen_dates) d(day) where day is null or day !~ '^\d{4}-\d{2}-\d{2}$') then
      raise exception 'Choose valid skills and availability.';
    end if;
    perform day::date from unnest(chosen_dates) d(day);

    if photo_base64 is not null then
      if remove_photo or length(photo_base64) > 262144 then raise exception 'Choose a smaller profile photo.'; end if;
      photo := decode(photo_base64, 'base64');
      if substring(photo from 1 for 3) <> decode('ffd8ff', 'hex') then raise exception 'Choose a JPEG profile photo.'; end if;
    end if;

    update public.profiles p set
      signup_intent = intent,
      signup_skills = chosen_skills,
      seva_preferences = jsonb_build_object(
        'interests', chosen_interests, 'availability', chosen_availability, 'dates', chosen_dates, 'emergency', emergency
      ),
      seva_photo = case when remove_photo then null else coalesce(photo, p.seva_photo) end
    where p.id = viewer;

    if account.person_id is not null then
      if intent = 'Volunteer' then
        update public.people set is_volunteer = true where id = account.person_id and not is_volunteer;
      end if;
      if intent = 'Volunteer' or exists (select 1 from public.volunteer_profiles v where v.person_id = account.person_id) then
        insert into public.volunteer_profiles (person_id, skills, interests, emergency_seva)
        values (account.person_id, chosen_skills, chosen_interests, emergency)
        on conflict (person_id) do update set
          skills = excluded.skills, interests = excluded.interests, emergency_seva = excluded.emergency_seva,
          is_simulated = false, updated_at = now();
      end if;
    end if;
  end if;

  select jsonb_build_object(
    'intent', p.signup_intent,
    'skills', case when p.seva_preferences is null and not v.is_simulated then v.skills else p.signup_skills end,
    'interests', coalesce(p.seva_preferences->'interests', to_jsonb(case when not v.is_simulated then v.interests end), '[]'::jsonb),
    'availability', coalesce(p.seva_preferences->'availability', '[]'::jsonb),
    'dates', coalesce(p.seva_preferences->'dates', '[]'::jsonb),
    'emergency', coalesce((p.seva_preferences->>'emergency')::boolean, false),
    'complete', p.seva_preferences is not null,
    'has_photo', p.seva_photo is not null
  ) into saved_profile
  from public.profiles p left join public.volunteer_profiles v on v.person_id = p.person_id
  where p.id = viewer and p.signup_intent is not null;
  return saved_profile;
end;
$$;

revoke all on function public.teamup_seva_profile(jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.teamup_seva_profile(jsonb, text, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
