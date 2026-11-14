-- TeamUp database schema
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.

-- =========================================================
-- 1. Tables
-- =========================================================

-- One row per real person, after merging duplicates across Eventbrite, Harmony and Retreat Guru.
-- Email and phone are private: only the person themself (and organizers of events they're invited to) can read them.
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  origin text not null default 'app' check (origin in ('seed', 'app')),
  full_name text not null,
  email text,
  phone text,
  city text,
  timezone text not null default 'America/Toronto',
  is_volunteer boolean not null default false,
  is_teacher boolean not null default false,
  last_course text,
  last_course_date date,
  courses_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists people_email_idx on public.people (lower(email));

-- Which source records were merged into each person (for audit; never exposed to the app)
create table if not exists public.person_sources (
  person_id uuid not null references public.people(id) on delete cascade,
  source_system text not null,
  source_table text not null,
  external_id text not null,
  primary key (source_table, external_id)
);
create index if not exists person_sources_person_idx on public.person_sources (person_id);

-- App accounts (one per signed-in user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  role text not null default 'volunteer' check (role in ('volunteer', 'organizer')),
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.volunteer_profiles (
  person_id uuid primary key references public.people(id) on delete cascade,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  emergency_seva boolean not null default false,
  is_simulated boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Weekly availability. day_of_week: 0 = Sunday ... 6 = Saturday
create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Toronto',
  is_simulated boolean not null default false,
  check (end_time > start_time)
);
create index if not exists availability_person_idx on public.availability (person_id);

-- Events: imported programs plus events organizers create in TeamUp (source_system = 'teamup').
-- Write starts_local/ends_local in the event's own time zone; starts_at/ends_at are filled in automatically.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'teamup',
  source_id text,
  title text not null,
  description text,
  category text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  city text,
  venue_name text,
  starts_local timestamp not null,
  ends_local timestamp not null,
  timezone text not null default 'America/Toronto',
  starts_at timestamptz,
  ends_at timestamptz,
  schedule jsonb,
  required_skills text[] not null default '{}',
  volunteers_needed int not null default 1 check (volunteers_needed > 0),
  organizer_person_id uuid references public.people(id) on delete set null,
  organizer_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  is_simulated_needs boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_system, source_id),
  check (ends_local >= starts_local)
);
create index if not exists events_starts_idx on public.events (starts_at);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invited_by uuid default auth.uid() references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, person_id) -- no duplicate invitations
);

create table if not exists public.courses (
  name text primary key,
  mctypes text
);

-- =========================================================
-- 2. Helper functions used by the security rules
-- =========================================================

create or replace function public.my_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select person_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_organizer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'organizer')
$$;

-- An organizer owns an event they created, or an imported program they teach or organize
create or replace function public.owns_event(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_organizer() and exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (e.organizer_user_id = auth.uid()
           or (e.organizer_person_id is not null and e.organizer_person_id = public.my_person_id()))
  )
$$;

-- =========================================================
-- 3. Triggers
-- =========================================================

-- Convert local event times to real timestamps
create or replace function public.set_event_times() returns trigger
language plpgsql as $$
begin
  new.starts_at := new.starts_local at time zone new.timezone;
  new.ends_at := new.ends_local at time zone new.timezone;
  return new;
end $$;
drop trigger if exists events_set_times on public.events;
create trigger events_set_times before insert or update on public.events
  for each row execute function public.set_event_times();

-- New account: link to an existing person by email (or create one), and only allow
-- the organizer role for emails that match an Art of Living teacher record.
create or replace function public.link_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = new.id;
  new.person_id := null; -- never trust a person_id sent by the browser
  select id into new.person_id from public.people
    where v_email is not null and lower(email) = lower(v_email)
    order by is_teacher desc, created_at limit 1;
  if new.role = 'organizer' and not exists (
    select 1 from public.people where id = new.person_id and is_teacher
  ) then
    raise exception 'Organizer accounts must match an Art of Living teacher record';
  end if;
  if new.person_id is null then
    insert into public.people (full_name, email)
    values (coalesce(nullif(new.full_name, ''), split_part(v_email, '@', 1)), v_email)
    returning id into new.person_id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_link on public.profiles;
create trigger profiles_link before insert on public.profiles
  for each row execute function public.link_profile();

-- Record when a volunteer answers an invitation
create or replace function public.set_responded_at() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then new.responded_at := now(); end if;
  return new;
end $$;
drop trigger if exists invitations_responded on public.invitations;
create trigger invitations_responded before update on public.invitations
  for each row execute function public.set_responded_at();

-- =========================================================
-- 4. Search and matching (organizers only; no email or phone returned)
-- =========================================================

create or replace view public.volunteer_directory as
select p.id as person_id, p.full_name, p.city, p.timezone,
       p.last_course, p.last_course_date, p.courses_count,
       v.skills, v.emergency_seva, v.is_simulated as skills_simulated
from public.people p
join public.volunteer_profiles v on v.person_id = p.id
where public.is_organizer();

-- Matching v1, rule-based: availability is required, then rank by
-- skills (50%), availability (35%) and same city (15%), with plain-language reasons.
-- Note: compares local clock times, assuming volunteers serve events in their own area.
create or replace function public.match_volunteers(
  p_event_id uuid, p_limit int default 50, p_include_unavailable boolean default false
) returns table (
  person_id uuid, full_name text, city text, skills text[], matched_skills text[],
  available boolean, same_city boolean, score numeric, reasons text[], invitation_status text
)
language sql stable security definer set search_path = public as $$
  with ev as (
    select e.*,
           extract(dow from e.starts_local)::int as dow,
           e.starts_local::time as s_start,
           case when e.ends_local::date = e.starts_local::date then e.ends_local::time
                else coalesce((e.schedule -> 0 ->> 'end')::time, e.ends_local::time) end as s_end
    from public.events e
    where e.id = p_event_id and public.is_organizer()
  ), cand as (
    select p.id as pid, p.full_name as pname, p.city as pcity, v.skills as vskills, v.emergency_seva,
           array(select unnest(v.skills) intersect select unnest(ev.required_skills)) as matched,
           exists (select 1 from public.availability a
                   where a.person_id = p.id and a.day_of_week = ev.dow
                     and a.start_time <= ev.s_start and a.end_time >= ev.s_end) as avail,
           (ev.city = 'Online' or lower(p.city) = lower(ev.city)) as near,
           cardinality(ev.required_skills) as req_n,
           ev.starts_local as ev_start
    from public.people p
    join public.volunteer_profiles v on v.person_id = p.id
    cross join ev
  )
  select c.pid, c.pname, c.pcity, c.vskills, c.matched, c.avail, coalesce(c.near, false),
         round((case when c.req_n = 0 then 50 else 50.0 * cardinality(c.matched) / c.req_n end)
               + (case when c.avail then 35 else 0 end)
               + (case when c.near then 15 else 0 end), 1) as score,
         array_remove(array[
           case when cardinality(c.matched) > 0 then 'Skills: ' || array_to_string(c.matched, ', ') end,
           case when c.avail then 'Free on ' || to_char(c.ev_start, 'FMDay') || 's at this time' end,
           case when c.near then 'Based in ' || c.pcity end,
           case when c.emergency_seva then 'Open to last-minute seva' end
         ], null) as reasons,
         i.status
  from cand c
  left join public.invitations i on i.event_id = p_event_id and i.person_id = c.pid
  where c.avail or p_include_unavailable
  order by score desc, c.pname
  limit p_limit
$$;

-- =========================================================
-- 5. Seed helpers (only the seed script can run these)
-- =========================================================

create or replace function public.reset_seed_data() returns void
language sql security definer set search_path = public as $$
  delete from public.events where source_system <> 'teamup';
  delete from public.people where origin = 'seed';
  delete from public.courses where true;
$$;

create or replace function public.relink_profiles() returns void
language sql security definer set search_path = public as $$
  update public.profiles pr set person_id = p.id
  from auth.users u, public.people p
  where pr.id = u.id and pr.person_id is null and lower(p.email) = lower(u.email);
$$;

-- =========================================================
-- 6. Row Level Security
-- =========================================================

alter table public.people enable row level security;
alter table public.person_sources enable row level security;
alter table public.profiles enable row level security;
alter table public.volunteer_profiles enable row level security;
alter table public.availability enable row level security;
alter table public.events enable row level security;
alter table public.invitations enable row level security;
alter table public.courses enable row level security;

-- people: see and edit yourself; organizers can see people they invited
drop policy if exists people_select on public.people;
create policy people_select on public.people for select to authenticated
  using (id = public.my_person_id()
         or exists (select 1 from public.invitations i
                    where i.person_id = people.id and public.owns_event(i.event_id)));
drop policy if exists people_update on public.people;
create policy people_update on public.people for update to authenticated
  using (id = public.my_person_id()) with check (id = public.my_person_id());

-- person_sources: no policies, so only the seed script can read it

-- profiles: your own only
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- volunteer_profiles and availability: edit your own; organizers can read
drop policy if exists vp_select on public.volunteer_profiles;
create policy vp_select on public.volunteer_profiles for select to authenticated
  using (person_id = public.my_person_id() or public.is_organizer());
drop policy if exists vp_write on public.volunteer_profiles;
create policy vp_write on public.volunteer_profiles for all to authenticated
  using (person_id = public.my_person_id()) with check (person_id = public.my_person_id());

drop policy if exists avail_select on public.availability;
create policy avail_select on public.availability for select to authenticated
  using (person_id = public.my_person_id() or public.is_organizer());
drop policy if exists avail_write on public.availability;
create policy avail_write on public.availability for all to authenticated
  using (person_id = public.my_person_id()) with check (person_id = public.my_person_id());

-- events: everyone signed in can read; organizers manage their own
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated using (true);
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (public.is_organizer() and organizer_user_id = auth.uid() and source_system = 'teamup');
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.owns_event(id)) with check (public.owns_event(id));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (organizer_user_id = auth.uid());

-- invitations: volunteers see and answer their own; organizers manage their events' invitations
drop policy if exists inv_select on public.invitations;
create policy inv_select on public.invitations for select to authenticated
  using (person_id = public.my_person_id() or public.owns_event(event_id));
drop policy if exists inv_insert on public.invitations;
create policy inv_insert on public.invitations for insert to authenticated
  with check (public.owns_event(event_id) and status = 'pending');
drop policy if exists inv_update on public.invitations;
create policy inv_update on public.invitations for update to authenticated
  using (person_id = public.my_person_id()) with check (person_id = public.my_person_id());
drop policy if exists inv_delete on public.invitations;
create policy inv_delete on public.invitations for delete to authenticated
  using (public.owns_event(event_id));

-- courses: public list
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to anon, authenticated using (true);

-- =========================================================
-- 7. Permissions (new tables are not exposed automatically)
-- =========================================================

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;

grant select on public.courses to anon, authenticated;
grant select on public.people to authenticated;
grant update (full_name, phone, city, timezone) on public.people to authenticated;
grant select, insert on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated; -- role can't be self-changed
grant select, insert, update, delete on public.volunteer_profiles, public.availability to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, delete on public.invitations to authenticated;
grant update (status) on public.invitations to authenticated; -- volunteers can only change the answer
grant select on public.volunteer_directory to authenticated;

grant execute on function public.my_person_id(), public.is_organizer(), public.owns_event(uuid) to authenticated;
grant execute on function public.match_volunteers(uuid, int, boolean) to authenticated;
revoke execute on function public.reset_seed_data(), public.relink_profiles() from public, anon, authenticated;
grant execute on function public.reset_seed_data(), public.relink_profiles() to service_role;

notify pgrst, 'reload schema';
