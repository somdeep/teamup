begin;

alter table public.teacher_access_requests
  add column reviewed_by uuid references auth.users(id) on delete set null;

create function public.teamup_pending_teacher_access_requests()
returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'account_id', r.account_id,
    'full_name', coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), u.email),
    'email', u.email,
    'location', person.city,
    'requested_at', r.requested_at
  )
  from public.teacher_access_requests r
  join public.profiles p on p.id = r.account_id
  join auth.users u on u.id = r.account_id
  left join public.people person on person.id = p.person_id
  where public.is_teacher() and r.status = 'pending'
    and p.account_role <> 'teacher'
  order by r.requested_at, r.account_id
$$;

create or replace function public.teamup_review_teacher_access(p_account_id uuid, p_approved boolean)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  linked_person uuid;
begin
  if not public.is_teacher() or p_approved is null or p_account_id = auth.uid() then return false; end if;

  select p.person_id into linked_person
  from public.teacher_access_requests r
  join public.profiles p on p.id = r.account_id
  join auth.users u on u.id = p.id
  join public.people person on person.id = p.person_id
  where r.account_id = p_account_id and r.status = 'pending'
    and p.account_role <> 'teacher' and p.signup_intent is not null
    and u.email_confirmed_at is not null
    and lower(btrim(person.email)) = lower(btrim(u.email))
  for update of r, p;
  if not found then return false; end if;

  if p_approved then
    update public.profiles set account_role = 'teacher' where id = p_account_id;
    update public.people set is_teacher = true where id = linked_person;
  end if;

  update public.teacher_access_requests
  set status = case when p_approved then 'approved' else 'declined' end,
      reviewed_at = now(), reviewed_by = auth.uid()
  where account_id = p_account_id and status = 'pending';
  return found;
end;
$$;

revoke all on function public.teamup_pending_teacher_access_requests(),
  public.teamup_review_teacher_access(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.teamup_pending_teacher_access_requests(),
  public.teamup_review_teacher_access(uuid,boolean)
  to authenticated;

notify pgrst, 'reload schema';

commit;
