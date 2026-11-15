begin;

-- A small, traceable demo journey for the hackathon test accounts. This seed
-- is repeatable and deliberately uses only event and participation data.
do $$
declare
  teacher_account uuid;
  teacher_person uuid;
  volunteer_person uuid;
begin
  select u.id, p.person_id into teacher_account, teacher_person
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = 'somdeepdey10@gmail.com' and p.account_role = 'teacher';

  select p.person_id into volunteer_person
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = 'sd2988@columbia.edu' and p.account_role = 'volunteer';

  if teacher_account is null or teacher_person is null then
    raise exception 'Demo teacher somdeepdey10@gmail.com is missing or is not a teacher.';
  end if;
  if volunteer_person is null then
    raise exception 'Demo volunteer sd2988@columbia.edu is missing or is not a volunteer.';
  end if;

  insert into public.events (
    id, source_system, source_id, title, description, category, status,
    city, venue_name, starts_local, ends_local, timezone, required_skills,
    volunteers_needed, organizer_person_id, organizer_user_id
  ) values
    ('4f70a21a-b9cc-46cb-a358-3f1b9760b101', 'teamup_demo', 'journey-music-meditation-202603',
      'Music & Meditation Event', 'Demo history record for the volunteer journey.', null, 'completed',
      'Toronto', 'Toronto Art of Living Centre', '2026-03-21 17:00', '2026-03-21 20:00', 'America/Toronto',
      array['Music & bhajans']::text[], 8, teacher_person, teacher_account),
    ('6c95e2ce-0eb3-47ed-a12c-256bcf026102', 'teamup_demo', 'journey-part-2-course-202601',
      'Art of Living Part 2 Course', 'Demo course-support history record for the volunteer journey.', 'course', 'completed',
      'Toronto', 'Toronto Art of Living Centre', '2026-01-23 18:00', '2026-01-25 17:00', 'America/Toronto',
      array['Decor','Registration desk']::text[], 6, teacher_person, teacher_account),
    ('15cc2032-663f-4fdd-8737-555bf7e46103', 'teamup_demo', 'journey-community-food-202512',
      'Community Food Seva', 'Demo history record for the volunteer journey.', null, 'completed',
      'Toronto', 'Community Hall', '2025-12-13 09:00', '2025-12-13 14:00', 'America/Toronto',
      array['Kitchen seva']::text[], 12, teacher_person, teacher_account)
  on conflict (source_system, source_id) do update set
    title = excluded.title, description = excluded.description, category = excluded.category,
    status = excluded.status, city = excluded.city, venue_name = excluded.venue_name,
    starts_local = excluded.starts_local, ends_local = excluded.ends_local, timezone = excluded.timezone,
    required_skills = excluded.required_skills, volunteers_needed = excluded.volunteers_needed,
    organizer_person_id = excluded.organizer_person_id, organizer_user_id = excluded.organizer_user_id;

  insert into public.event_assignments (event_id, person_id, role)
  select e.id, teacher_person, 'organizer'
  from public.events e
  where e.source_system = 'teamup_demo' and e.source_id in (
    'journey-music-meditation-202603', 'journey-part-2-course-202601', 'journey-community-food-202512'
  )
  on conflict do nothing;

  insert into public.invitations (
    event_id, person_id, status, invited_by, invited_at, responded_at, request_source, requested_role
  )
  select e.id, volunteer_person, 'accepted', teacher_account,
    coalesce(e.starts_at, now()) - interval '30 days', coalesce(e.starts_at, now()) - interval '29 days',
    'volunteer_application',
    case e.source_id
      when 'journey-music-meditation-202603' then 'Music & bhajans'
      when 'journey-part-2-course-202601' then 'Decor'
      else 'Kitchen seva'
    end
  from public.events e
  where e.source_system = 'teamup_demo' and e.source_id in (
    'journey-music-meditation-202603', 'journey-part-2-course-202601', 'journey-community-food-202512'
  )
  on conflict (event_id, person_id) do update set
    status = 'accepted', invited_by = excluded.invited_by, responded_at = excluded.responded_at,
    request_source = excluded.request_source, requested_role = excluded.requested_role;
end;
$$;

commit;
