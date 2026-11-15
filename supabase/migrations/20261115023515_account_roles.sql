begin;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles rename column role to account_role;
update public.profiles set account_role = case
  when account_role = 'organizer' then 'teacher'
  when signup_intent = 'Volunteer' then 'volunteer'
  else 'member' end;
alter table public.profiles alter column account_role set default 'member';
alter table public.profiles add constraint profiles_account_role_check
  check (account_role in ('teacher', 'volunteer', 'member'));

-- Read-only compatibility for the app currently deployed. All decisions use account_role.
alter table public.profiles add column role text generated always as (
  case when account_role = 'teacher' then 'organizer' else 'volunteer' end
) stored;

alter table public.profiles drop constraint profiles_signup_intent_check;
alter table public.profiles add constraint profiles_signup_intent_check
  check (signup_intent in ('Teacher', 'Volunteer', 'Member'));

create table public.teacher_access_requests (
  account_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.teacher_access_requests enable row level security;
revoke all on public.teacher_access_requests from public, anon, authenticated;
grant select on public.teacher_access_requests to service_role;

create function public.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_role = 'teacher')
$$;
revoke all on function public.is_teacher() from public, anon, authenticated;
grant execute on function public.is_teacher() to authenticated;

create or replace function public.is_organizer() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_teacher()
$$;

create or replace function public.link_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.person_id := public.teamup_verified_person(new.id, new.full_name);
  return new;
end;
$$;

create function public.teamup_account_access() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  resolved_role text;
  roster_teacher boolean;
  request_status text;
begin
  select p.account_role, coalesce(person.is_teacher and person.origin = 'app'
      and lower(btrim(person.email)) = lower(btrim(u.email)), false)
    into resolved_role, roster_teacher
  from public.profiles p join auth.users u on u.id = p.id
  left join public.people person on person.id = p.person_id
  where p.id = viewer and p.signup_intent is not null and u.email_confirmed_at is not null;
  if not found then return null; end if;

  if resolved_role <> 'teacher' and roster_teacher then
    update public.profiles p set account_role = 'teacher' where p.id = viewer;
    update public.teacher_access_requests set status = 'approved', reviewed_at = now()
      where account_id = viewer and status <> 'approved';
    resolved_role := 'teacher';
  end if;

  select r.status into request_status from public.teacher_access_requests r where r.account_id = viewer;
  return jsonb_build_object('role', resolved_role, 'teacher_request', request_status);
end;
$$;

create function public.teamup_request_teacher_access() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  access jsonb := public.teamup_account_access();
begin
  if access is null or access->>'role' = 'teacher' then return access; end if;
  insert into public.teacher_access_requests (account_id) values (auth.uid()) on conflict (account_id) do nothing;
  return public.teamup_account_access();
end;
$$;

create function public.teamup_review_teacher_access(p_account_id uuid, p_approved boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  linked_person uuid;
begin
  if p_approved is null then return false; end if;
  select person.id into linked_person from public.profiles p
  join auth.users u on u.id = p.id
  join public.people person on person.id = p.person_id
  where p.id = p_account_id and p.signup_intent is not null and u.email_confirmed_at is not null
    and lower(btrim(person.email)) = lower(btrim(u.email))
  for update of p;
  if not found then return false; end if;

  if p_approved then
    update public.profiles set account_role = 'teacher' where id = p_account_id;
    update public.people set is_teacher = true where id = linked_person;
    insert into public.teacher_access_requests (account_id, status, reviewed_at)
      values (p_account_id, 'approved', now()) on conflict (account_id) do update
      set status = 'approved', reviewed_at = excluded.reviewed_at
      where teacher_access_requests.status <> 'approved';
    return true;
  end if;

  update public.teacher_access_requests set status = 'declined', reviewed_at = now()
    where account_id = p_account_id and status = 'pending';
  return found;
end;
$$;

revoke all on function public.teamup_account_access(), public.teamup_request_teacher_access(),
  public.teamup_review_teacher_access(uuid,boolean) from public, anon, authenticated;
grant execute on function public.teamup_account_access(), public.teamup_request_teacher_access() to authenticated;
grant execute on function public.teamup_review_teacher_access(uuid,boolean) to service_role;

insert into public.teacher_access_requests (account_id)
select p.id from public.profiles p join auth.users u on u.id = p.id
where p.signup_intent = 'Teacher' and p.account_role <> 'teacher' and u.email_confirmed_at is not null;

-- Preserve the existing signup and preferences RPCs while accepting Member.
create or replace function public.teamup_signup_profile(profile jsonb default null) returns jsonb
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
        or coalesce(intent, '') not in ('Teacher', 'Volunteer', 'Member') then
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
      signup_intent = intent, signup_courses = courses, signup_skills = skills,
      account_role = case when p.account_role = 'teacher' then 'teacher'
        when intent = 'Volunteer' then 'volunteer' else 'member' end
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

    if intent = 'Teacher' then
      perform public.teamup_request_teacher_access();
    else
      perform public.teamup_account_access();
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

create or replace function public.teamup_seva_profile(
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
    if coalesce(intent, '') not in ('Teacher', 'Volunteer', 'Member')
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

-- Match only events owned by the teacher who requested recommendations.
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
    where e.id = p_event_id and public.owns_event(e.id)
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

notify pgrst, 'reload schema';
commit;
