begin;

alter table public.profiles add column seva_skills_reviewed_at timestamptz;

create function public.teamup_skills_profile(skills text[] default null, interests text[] default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  account public.profiles%rowtype;
  saved_profile jsonb;
  reviewed boolean;
begin
  if (skills is null) <> (interests is null) then
    raise exception 'Submit both skills and learning interests.';
  end if;

  if skills is null then
    saved_profile := public.teamup_seva_profile();
    select p.seva_skills_reviewed_at is not null into reviewed from public.profiles p where p.id = viewer;
  else
    -- Keep this edit and other preference edits serialized on the same row.
    select * into account from public.profiles p where p.id = viewer and p.seva_preferences is not null for update;
    if not found then return null; end if;
    saved_profile := public.teamup_seva_profile(account.seva_preferences || jsonb_build_object(
      'intent', account.signup_intent, 'skills', skills, 'interests', interests
    ));
    if saved_profile is not null then
      update public.profiles p set seva_skills_reviewed_at = now() where p.id = viewer;
      reviewed := true;
    end if;
  end if;

  return saved_profile || jsonb_build_object('skills_reviewed', coalesce(reviewed, false));
end;
$$;

revoke all on function public.teamup_skills_profile(text[], text[]) from public, anon, authenticated;
grant execute on function public.teamup_skills_profile(text[], text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
