begin;

create function public.teamup_edit_account_profile(profile jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  account public.profiles%rowtype;
  person public.people%rowtype;
  submitted_name text;
  submitted_phone text;
  submitted_city text;
  submitted_timezone text;
  submitted_course text;
begin
  if not exists (select 1 from auth.users u where u.id = viewer and u.email_confirmed_at is not null) then
    raise exception 'A verified account is required.';
  end if;

  select pr.* into account
  from public.profiles pr
  where pr.id = viewer
  for update of pr;
  if not found then return null; end if;

  select p.* into person
  from public.people p
  where p.id = account.person_id
  for update of p;
  if not found then return null; end if;

  if profile is not null then
    if jsonb_typeof(profile) is distinct from 'object'
        or jsonb_typeof(profile->'display_name') is distinct from 'string'
        or jsonb_typeof(profile->'city') is distinct from 'string'
        or jsonb_typeof(profile->'timezone') is distinct from 'string' then
      raise exception 'Enter valid profile details.';
    end if;

    submitted_name := btrim(profile->>'display_name');
    submitted_phone := nullif(btrim(profile->>'contact_phone'), '');
    submitted_city := btrim(profile->>'city');
    submitted_timezone := profile->>'timezone';
    submitted_course := nullif(btrim(profile->>'last_course'), '');
    if submitted_name = '' or length(submitted_name) > 100
        or submitted_city = '' or length(submitted_city) > 100
        or length(submitted_phone) > 32 or length(submitted_course) > 120
        or submitted_timezone not in (
          'America/Vancouver', 'America/Edmonton', 'America/Regina', 'America/Winnipeg',
          'America/Toronto', 'America/Halifax', 'America/St_Johns'
        ) then
      raise exception 'Check your profile field lengths and time zone.';
    end if;

    update public.profiles set full_name = submitted_name where id = viewer;
    update public.people set
      full_name = submitted_name,
      phone = submitted_phone,
      city = submitted_city,
      timezone = submitted_timezone,
      last_course = submitted_course
    where id = account.person_id;
  end if;

  return jsonb_build_object(
    'display_name', coalesce(submitted_name, account.full_name),
    'contact_phone', case when profile is null then person.phone else submitted_phone end,
    'city', case when profile is null then person.city else submitted_city end,
    'timezone', case when profile is null then person.timezone else submitted_timezone end,
    'last_course', case when profile is null then person.last_course else submitted_course end
  );
end;
$$;

revoke all on function public.teamup_edit_account_profile(jsonb)
  from public, anon, authenticated;
grant execute on function public.teamup_edit_account_profile(jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;
