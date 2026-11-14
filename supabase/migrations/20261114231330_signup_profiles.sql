begin;

alter table public.profiles
  add column signup_intent text check (signup_intent in ('Teacher', 'Volunteer')),
  add column signup_courses text[] not null default '{}',
  add column signup_skills text[] not null default '{}';

create unique index profiles_unique_person on public.profiles (person_id);

-- Row ownership alone does not stop a client changing its role or person link.
drop policy profiles_insert on public.profiles;
drop policy profiles_update on public.profiles;
revoke insert, update, delete, truncate on public.profiles from public, anon, authenticated;

revoke update on public.people from public, anon, authenticated;
grant update (full_name, phone, city, timezone, last_course) on public.people to authenticated;

revoke update on public.invitations from public, anon, authenticated;
grant update (status) on public.invitations to authenticated;

-- The view already projects organizer-only directory fields. Keep its gate and
-- grant view reads only to signed-in clients.
alter view public.volunteer_directory set (security_barrier = true);
revoke all on public.volunteer_directory from public, anon, authenticated;
grant select on public.volunteer_directory to authenticated;

create function public.teamup_verified_person(account_id uuid, submitted_name text) returns uuid
language plpgsql set search_path = ''
as $$
declare
  verified_email text;
  candidates uuid[];
  person uuid;
begin
  select nullif(lower(btrim(u.email)), '') into verified_email from auth.users u
  where u.id = account_id and u.email_confirmed_at is not null;
  if verified_email is null then raise exception 'A verified email address is required.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(verified_email, 1));
  candidates := array(select p.id from public.people p where lower(btrim(p.email)) = verified_email limit 2);
  if cardinality(candidates) > 1 then raise exception 'This email needs a manual account link.'; end if;
  person := candidates[1];

  if person is null then
    insert into public.people (full_name, email)
    values (coalesce(nullif(btrim(submitted_name), ''), split_part(verified_email, '@', 1)), verified_email)
    returning id into person;
  elsif exists (select 1 from public.profiles p where p.person_id = person and p.id <> account_id) then
    raise exception 'This person is already linked to a TeamUp account.';
  end if;
  return person;
end;
$$;

revoke all on function public.teamup_verified_person(uuid, text) from public, anon, authenticated;

create or replace function public.link_profile() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.person_id := public.teamup_verified_person(new.id, new.full_name);
  if new.role = 'organizer' and not exists (
    select 1 from public.people p where p.id = new.person_id and p.is_teacher
  ) then
    raise exception 'Organizer accounts must match an Art of Living teacher record.';
  end if;
  return new;
end;
$$;

revoke execute on function public.link_profile() from public, anon, authenticated;

-- Retain the service-only helper used after a seed refresh. Link unique,
-- verified email matches and keep any already-linked person reserved.
create or replace function public.relink_profiles() returns void
language sql security definer set search_path = ''
as $$
  with matches as (
    select pr.id, (array_agg(p.id))[1] as person_id
    from public.profiles pr join auth.users u on u.id = pr.id
    join public.people p on lower(btrim(p.email)) = lower(btrim(u.email))
    where pr.person_id is null and u.email_confirmed_at is not null and btrim(u.email) <> ''
    group by pr.id having count(*) = 1
  ), unique_matches as (
    select person_id from matches group by person_id having count(*) = 1
  )
  update public.profiles pr set person_id = m.person_id
  from matches m join unique_matches um using (person_id)
  where pr.id = m.id and pr.person_id is null
    and not exists (select 1 from public.profiles existing where existing.person_id = m.person_id)
$$;

revoke execute on function public.relink_profiles() from public, anon, authenticated;
revoke execute on function public.match_volunteers(uuid, integer, boolean) from public, anon;
grant execute on function public.match_volunteers(uuid, integer, boolean) to authenticated;

create function public.teamup_signup_profile(profile jsonb default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  metadata jsonb;
  candidate jsonb;
  account public.profiles%rowtype;
  name text;
  intent text;
  submitted_phone text;
  recent_course text;
  courses text[];
  skills text[];
  saved_profile jsonb;
begin
  select u.raw_user_meta_data into metadata from auth.users u
  where u.id = viewer and u.email_confirmed_at is not null and nullif(btrim(u.email), '') is not null;
  if not found then raise exception 'A verified email address is required.'; end if;

  -- Serialize retries before the link trigger can create a person row.
  perform pg_advisory_xact_lock(hashtextextended(viewer::text, 0));
  select * into account from public.profiles p where p.id = viewer;

  if account.signup_intent is null then
    candidate := coalesce(profile, metadata->'teamup_pending_profile', metadata);
    name := btrim(candidate->>'display_name');
    intent := candidate->>'signup_intent';
    if jsonb_typeof(candidate->'display_name') is distinct from 'string'
        or name !~ '[^[:space:]]' or length(name) > 100
        or coalesce(intent, '') not in ('Teacher', 'Volunteer') then
      return null;
    end if;

    if jsonb_typeof(candidate->'contact_phone') = 'string' then
      submitted_phone := nullif(btrim(candidate->>'contact_phone'), '');
    end if;
    if jsonb_typeof(candidate->'last_course') = 'string' then
      recent_course := nullif(btrim(candidate->>'last_course'), '');
    end if;

    select
      coalesce(array_agg(distinct choice order by choice) filter (
        where choice in (select c.name from public.courses c)
          or choice in ('Happiness Program', 'SKY Breath Meditation', 'Sri Sri Yoga')
      ), '{}'),
      coalesce(array_agg(distinct skill order by skill) filter (where skill in (
        'Community Outreach', 'Decor', 'Driving', 'Greeting & hospitality', 'Kids activities', 'Kitchen seva',
        'Music & bhajans', 'Photography', 'Registration desk', 'Setup & logistics', 'Social media',
        'Teaching', 'Tech & AV', 'Translation'
      )), '{}')
    into courses, skills
    from jsonb_array_elements_text(case when jsonb_typeof(candidate->'signup_expertise') = 'array'
      then candidate->'signup_expertise' else '[]'::jsonb end) as choices(choice)
    cross join lateral (select case choice
      when 'Event Setup' then 'Setup & logistics'
      when 'Food Service' then 'Kitchen seva'
      when 'Registration' then 'Registration desk'
      else choice end as skill) as normalized;

    if account.id is null then
      insert into public.profiles (id, full_name) values (viewer, name) returning * into account;
    elsif account.person_id is null then
      account.person_id := public.teamup_verified_person(viewer, name);
    end if;

    update public.profiles p set person_id = account.person_id, full_name = name,
      signup_intent = intent, signup_courses = courses, signup_skills = skills
    where p.id = viewer;

    update public.people p set
      phone = case when length(submitted_phone) <= 32 then submitted_phone else p.phone end,
      last_course = case when length(recent_course) <= 120 then recent_course else p.last_course end,
      is_volunteer = p.is_volunteer or intent = 'Volunteer'
    where p.id = account.person_id;

    if intent = 'Volunteer' then
      insert into public.volunteer_profiles (person_id, skills) values (account.person_id, skills)
      on conflict (person_id) do update set skills = excluded.skills, is_simulated = false, updated_at = now()
      where cardinality(excluded.skills) > 0;
    end if;
  end if;

  select jsonb_build_object(
    'display_name', pr.full_name, 'signup_intent', pr.signup_intent,
    'contact_phone', p.phone, 'last_course', p.last_course,
    'courses', pr.signup_courses,
    'skills', case when pr.signup_intent = 'Volunteer' then coalesce(v.skills, pr.signup_skills) else pr.signup_skills end
  ) into saved_profile
  from public.profiles pr
  left join public.people p on p.id = pr.person_id
  left join public.volunteer_profiles v on v.person_id = pr.person_id
  where pr.id = viewer;
  return saved_profile;
end;
$$;

revoke all on function public.teamup_signup_profile(jsonb) from public, anon, authenticated;
grant execute on function public.teamup_signup_profile(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
