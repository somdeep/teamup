begin;

create table public.event_resources (
  event_id uuid primary key references public.events(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 200),
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  file_size integer not null check (file_size between 1 and 10485760),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.event_resources enable row level security;
revoke all on public.event_resources from public, anon, authenticated;
grant select on public.event_resources to authenticated;
grant select, insert, update, delete on public.event_resources to service_role;
create policy event_resources_circle_read on public.event_resources
  for select to authenticated using (public.can_access_event_circle(event_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-resources', 'event-resources', false, 10485760,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy event_resources_file_read on storage.objects
  for select to authenticated using (
    bucket_id = 'event-resources'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_access_event_circle(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy event_resources_file_add on storage.objects
  for insert to authenticated with check (
    bucket_id = 'event-resources'
    and (storage.foldername(name))[2] = auth.uid()::text
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.owns_event(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy event_resources_file_remove on storage.objects
  for delete to authenticated using (
    bucket_id = 'event-resources'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.owns_event(((storage.foldername(name))[1])::uuid)
        or (storage.foldername(name))[2] = auth.uid()::text
      else false
    end
  );

create function public.teamup_event_resource(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.can_access_event_circle(p_event_id) then (
    select jsonb_build_object(
      'event_id', r.event_id, 'storage_path', r.storage_path, 'file_name', r.file_name,
      'mime_type', r.mime_type, 'file_size', r.file_size, 'updated_at', r.updated_at
    ) from public.event_resources r where r.event_id = p_event_id
  ) end
$$;

create function public.teamup_set_event_resource(
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
  if not public.owns_event(p_event_id) then raise exception 'You cannot update this event resource.'; end if;
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

create function public.teamup_remove_event_resource(p_event_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare old_path text;
begin
  if not public.owns_event(p_event_id) then raise exception 'You cannot update this event resource.'; end if;
  delete from public.event_resources where event_id = p_event_id returning storage_path into old_path;
  return old_path;
end;
$$;

create function public.teamup_volunteer_resources(p_limit integer default 5) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone,
    'storage_path', r.storage_path, 'file_name', r.file_name,
    'mime_type', r.mime_type, 'file_size', r.file_size, 'updated_at', r.updated_at
  )
  from public.invitations i
  join public.events e on e.id = i.event_id
  left join public.event_resources r on r.event_id = e.id
  where exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.account_role = 'volunteer'
  )
    and i.person_id = public.my_person_id() and i.status = 'accepted'
    and e.status = 'scheduled' and e.starts_at > now()
  order by e.starts_at, e.id
  limit greatest(1, least(coalesce(p_limit, 5), 5))
$$;

revoke all on function public.teamup_event_resource(uuid),
  public.teamup_set_event_resource(uuid,text,text,text,integer),
  public.teamup_remove_event_resource(uuid), public.teamup_volunteer_resources(integer)
  from public, anon, authenticated;
grant execute on function public.teamup_event_resource(uuid),
  public.teamup_set_event_resource(uuid,text,text,text,integer),
  public.teamup_remove_event_resource(uuid), public.teamup_volunteer_resources(integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
