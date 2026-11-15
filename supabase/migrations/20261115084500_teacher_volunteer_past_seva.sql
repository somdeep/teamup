begin;

create function public.teamup_volunteer_past_seva(p_person_id uuid)
returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'event_id', e.id,
    'title', e.title,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'timezone', e.timezone,
    'city', e.city,
    'venue_name', e.venue_name,
    'category', e.category,
    'role', i.requested_role
  )
  from public.invitations i
  join public.events e on e.id = i.event_id
  where public.is_teacher()
    and i.person_id = p_person_id
    and i.status = 'accepted'
    and (e.status = 'completed' or e.ends_at < now())
    and exists (select 1 from public.volunteer_profiles v where v.person_id = p_person_id)
  order by e.ends_at desc, e.id
  limit 50
$$;

revoke all on function public.teamup_volunteer_past_seva(uuid) from public, anon, authenticated;
grant execute on function public.teamup_volunteer_past_seva(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
