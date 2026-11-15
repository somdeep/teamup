begin;

create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index event_messages_event_time_idx
  on public.event_messages (event_id, created_at, id);

alter table public.event_messages enable row level security;
revoke all on public.event_messages from public, anon, authenticated;
grant select, insert on public.event_messages to authenticated;
grant select, insert, update, delete on public.event_messages to service_role;

-- A circle includes assigned teachers/coordinators and volunteers who accepted
-- an invitation. Pending or declined invitations do not expose the circle.
create function public.can_access_event_circle(p_event_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.my_person_id() is not null and (
    public.owns_event(p_event_id)
    or exists (
      select 1 from public.event_assignments a
      where a.event_id = p_event_id and a.person_id = public.my_person_id()
    )
    or exists (
      select 1 from public.invitations i
      where i.event_id = p_event_id
        and i.person_id = public.my_person_id()
        and i.status = 'accepted'
    )
  )
$$;
revoke all on function public.can_access_event_circle(uuid) from public, anon, authenticated;
grant execute on function public.can_access_event_circle(uuid) to authenticated;

create policy event_messages_circle_read on public.event_messages
  for select to authenticated using (public.can_access_event_circle(event_id));
create policy event_messages_circle_post on public.event_messages
  for insert to authenticated with check (
    public.can_access_event_circle(event_id)
    and author_user_id = auth.uid()
    and person_id = public.my_person_id()
  );

create function public.teamup_event_circle(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.can_access_event_circle(p_event_id) then (
    select jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'description', e.description,
      'city', e.city,
      'venue_name', e.venue_name,
      'starts_at', e.starts_at,
      'ends_at', e.ends_at,
      'timezone', e.timezone,
      'volunteers_needed', e.volunteers_needed,
      'category', e.category,
      'status', e.status,
      'can_manage', public.owns_event(e.id),
      'confirmed_count', (
        select count(*) from public.invitations i
        where i.event_id = e.id and i.status = 'accepted'
      ),
      'my_invitation_status', (
        select i.status from public.invitations i
        where i.event_id = e.id and i.person_id = public.my_person_id()
      )
    )
    from public.events e where e.id = p_event_id
  ) end
$$;
revoke all on function public.teamup_event_circle(uuid) from public, anon, authenticated;
grant execute on function public.teamup_event_circle(uuid) to authenticated;

create function public.teamup_event_messages(p_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  person_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  is_mine boolean
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.event_id, m.person_id, p.full_name, m.body, m.created_at,
    m.author_user_id = auth.uid()
  from public.event_messages m
  join public.people p on p.id = m.person_id
  where m.event_id = p_event_id and public.can_access_event_circle(p_event_id)
  order by m.created_at, m.id
  limit 200
$$;
revoke all on function public.teamup_event_messages(uuid) from public, anon, authenticated;
grant execute on function public.teamup_event_messages(uuid) to authenticated;

create function public.teamup_post_event_message(p_event_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  message_id uuid;
  clean_body text := btrim(coalesce(p_body, ''));
begin
  if not public.can_access_event_circle(p_event_id) then
    raise exception 'Event circle unavailable.';
  end if;
  if char_length(clean_body) < 1 or char_length(clean_body) > 1000 then
    raise exception 'Message must be between 1 and 1000 characters.';
  end if;

  insert into public.event_messages (event_id, person_id, author_user_id, body)
  values (p_event_id, public.my_person_id(), auth.uid(), clean_body)
  returning id into message_id;
  return message_id;
end;
$$;
revoke all on function public.teamup_post_event_message(uuid, text) from public, anon, authenticated;
grant execute on function public.teamup_post_event_message(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
