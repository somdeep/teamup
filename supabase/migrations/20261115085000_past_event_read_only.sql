begin;

create function public.can_change_event(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.owns_event(p_event_id) and exists (
    select 1 from public.events e
    where e.id = p_event_id and e.status = 'scheduled' and e.ends_at > now()
  )
$$;

revoke all on function public.can_change_event(uuid) from public, anon, authenticated;
grant execute on function public.can_change_event(uuid) to authenticated;

create function public.teamup_event_is_past(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case when public.can_access_event_circle(p_event_id) then exists (
    select 1 from public.events e
    where e.id = p_event_id and (e.status = 'completed' or e.ends_at <= now())
  ) else null end
$$;

revoke all on function public.teamup_event_is_past(uuid) from public, anon, authenticated;
grant execute on function public.teamup_event_is_past(uuid) to authenticated;

create function public.teamup_reject_past_event_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_event_id is not null and auth.uid() is not null
    and not public.can_change_event(new.parent_event_id) then
    raise exception 'Past events cannot accept related seva.';
  end if;
  return new;
end;
$$;

revoke all on function public.teamup_reject_past_event_parent() from public, anon, authenticated;
create trigger events_reject_past_parent
  before insert or update of parent_event_id on public.events
  for each row execute function public.teamup_reject_past_event_parent();

create or replace function public.teamup_cancel_invitation(p_event_id uuid, p_invitation_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_change_event(p_event_id) then
    raise exception 'Past events are read-only.';
  end if;
  delete from public.invitations i
  where i.id = p_invitation_id and i.event_id = p_event_id
    and i.status in ('pending', 'accepted');
  return found;
end;
$$;

create or replace function public.teamup_cancel_application(p_invitation_id uuid)
returns boolean
language sql security definer set search_path = '' as $$
  update public.invitations i set status = 'declined', responded_at = now()
  where i.id = p_invitation_id and i.person_id = public.my_person_id()
    and i.request_source = 'volunteer_application' and i.status = 'pending'
    and exists (
      select 1 from public.events e
      where e.id = i.event_id and e.status = 'scheduled' and e.ends_at > now()
    )
  returning true
$$;

create or replace function public.teamup_review_application(p_invitation_id uuid, p_response text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  application public.invitations%rowtype;
begin
  if p_response not in ('accepted', 'declined') then return false; end if;
  select i.* into application from public.invitations i
  where i.id = p_invitation_id and i.request_source = 'volunteer_application' and i.status = 'pending'
    and public.can_change_event(i.event_id)
  for update;
  if not found then return false; end if;

  if p_response = 'accepted' then
    perform 1 from public.events e
    where e.id = application.event_id and e.status = 'scheduled' and e.starts_at > now()
      and e.volunteers_needed > (
        select count(*) from public.invitations i where i.event_id = e.id and i.status = 'accepted'
      )
    for update;
    if not found then return false; end if;
  end if;

  update public.invitations set status = p_response, responded_at = now()
  where id = application.id;
  return true;
end;
$$;

drop policy event_resources_file_add on storage.objects;
create policy event_resources_file_add on storage.objects
  for insert to authenticated with check (
    bucket_id = 'event-resources'
    and (storage.foldername(name))[2] = auth.uid()::text
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_change_event(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

drop policy event_resources_file_remove on storage.objects;
create policy event_resources_file_remove on storage.objects
  for delete to authenticated using (
    bucket_id = 'event-resources'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_change_event(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create or replace function public.teamup_set_event_resource(
  p_event_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size integer
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  old_path text;
  expected_prefix text := p_event_id::text || '/' || auth.uid()::text || '/';
begin
  if not public.can_change_event(p_event_id) then raise exception 'Past events are read-only.'; end if;
  if left(p_storage_path, char_length(expected_prefix)) <> expected_prefix
    or char_length(btrim(coalesce(p_file_name, ''))) not between 1 and 200
    or p_mime_type not in (
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    or p_file_size not between 1 and 10485760
    or not exists (
      select 1 from storage.objects o where o.bucket_id = 'event-resources' and o.name = p_storage_path
    )
  then raise exception 'Invalid event resource.'; end if;

  select r.storage_path into old_path from public.event_resources r where r.event_id = p_event_id;
  insert into public.event_resources (event_id, storage_path, file_name, mime_type, file_size, uploaded_by, updated_at)
  values (p_event_id, p_storage_path, btrim(p_file_name), p_mime_type, p_file_size, auth.uid(), now())
  on conflict (event_id) do update set
    storage_path = excluded.storage_path, file_name = excluded.file_name,
    mime_type = excluded.mime_type, file_size = excluded.file_size,
    uploaded_by = excluded.uploaded_by, updated_at = now();
  return old_path;
end;
$$;

create or replace function public.teamup_remove_event_resource(p_event_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare old_path text;
begin
  if not public.can_change_event(p_event_id) then raise exception 'Past events are read-only.'; end if;
  delete from public.event_resources where event_id = p_event_id returning storage_path into old_path;
  return old_path;
end;
$$;

notify pgrst, 'reload schema';

commit;
