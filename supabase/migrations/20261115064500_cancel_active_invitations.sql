begin;

create function public.teamup_cancel_invitation(p_event_id uuid, p_invitation_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.owns_event(p_event_id) then
    raise exception 'You can only cancel requests for events you manage.';
  end if;

  delete from public.invitations i
  where i.id = p_invitation_id
    and i.event_id = p_event_id
    and i.status in ('pending', 'accepted');
  return found;
end;
$$;

revoke all on function public.teamup_cancel_invitation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.teamup_cancel_invitation(uuid, uuid)
  to authenticated;

-- Volunteers may withdraw a confirmed commitment while the event is still
-- scheduled and has not started. Keep the row as declined for audit/history.
create function public.teamup_cancel_accepted_invitation(p_invitation_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  viewer_person uuid := public.my_person_id();
begin
  if viewer_person is null then return false; end if;

  update public.invitations i
  set status = 'declined'
  from public.events e
  where i.id = p_invitation_id
    and i.person_id = viewer_person
    and i.status = 'accepted'
    and e.id = i.event_id
    and e.status = 'scheduled'
    and e.starts_at > now();
  return found;
end;
$$;

revoke all on function public.teamup_cancel_accepted_invitation(uuid)
  from public, anon, authenticated;
grant execute on function public.teamup_cancel_accepted_invitation(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
