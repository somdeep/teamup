begin;

alter table public.event_messages
  add column image_path text,
  add column image_mime text,
  add column image_size integer,
  add constraint event_messages_image_metadata check (
    (image_path is null and image_mime is null and image_size is null)
    or (
      image_path is not null and char_length(image_path) between 1 and 500
      and image_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
      and image_size between 1 and 5242880
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-message-images', 'event-message-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy event_message_images_circle_read on storage.objects
  for select to authenticated using (
    bucket_id = 'event-message-images'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_access_event_circle(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy event_message_images_circle_add on storage.objects
  for insert to authenticated with check (
    bucket_id = 'event-message-images'
    and (storage.foldername(name))[2] = auth.uid()::text
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_access_event_circle(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy event_message_images_own_remove on storage.objects
  for delete to authenticated using (
    bucket_id = 'event-message-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop function public.teamup_event_messages(uuid);
create function public.teamup_event_messages(p_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  person_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  is_mine boolean,
  image_path text,
  image_mime text,
  image_size integer
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.event_id, m.person_id, p.full_name, m.body, m.created_at,
    m.author_user_id = auth.uid(), m.image_path, m.image_mime, m.image_size
  from public.event_messages m
  join public.people p on p.id = m.person_id
  where m.event_id = p_event_id and public.can_access_event_circle(p_event_id)
  order by m.created_at, m.id
  limit 200
$$;

create function public.teamup_post_event_message_with_image(
  p_event_id uuid,
  p_body text,
  p_image_path text default null,
  p_image_mime text default null,
  p_image_size integer default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  message_id uuid;
  clean_body text := btrim(coalesce(p_body, ''));
  expected_prefix text := p_event_id::text || '/' || auth.uid()::text || '/';
begin
  if not public.can_access_event_circle(p_event_id) then
    raise exception 'Event circle unavailable.';
  end if;
  if char_length(clean_body) < 1 or char_length(clean_body) > 1000 then
    raise exception 'Message must be between 1 and 1000 characters.';
  end if;
  if p_image_path is not null and (
    left(p_image_path, char_length(expected_prefix)) <> expected_prefix
    or p_image_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
    or p_image_size not between 1 and 5242880
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'event-message-images' and o.name = p_image_path
    )
  ) then
    raise exception 'Invalid event message image.';
  end if;
  if p_image_path is null and (p_image_mime is not null or p_image_size is not null) then
    raise exception 'Incomplete event message image.';
  end if;

  insert into public.event_messages (
    event_id, person_id, author_user_id, body, image_path, image_mime, image_size
  ) values (
    p_event_id, public.my_person_id(), auth.uid(), clean_body,
    p_image_path, p_image_mime, p_image_size
  ) returning id into message_id;
  return message_id;
end;
$$;

revoke all on function public.teamup_post_event_message_with_image(uuid,text,text,text,integer)
  from public, anon, authenticated;
revoke all on function public.teamup_event_messages(uuid) from public, anon, authenticated;
grant execute on function public.teamup_post_event_message_with_image(uuid,text,text,text,integer)
  to authenticated;
grant execute on function public.teamup_event_messages(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
