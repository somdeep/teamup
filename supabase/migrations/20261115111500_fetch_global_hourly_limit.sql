begin;

create table public.fetch_llm_hourly_usage (
  window_start timestamptz primary key,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.fetch_llm_hourly_usage enable row level security;
revoke all on table public.fetch_llm_hourly_usage from public, anon, authenticated;

create function public.teamup_claim_fetch_llm_request(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz := date_trunc('hour', clock_timestamp());
  claimed_count integer;
  retry_seconds integer;
begin
  if auth.uid() is null or not public.is_teacher() then
    raise exception 'Teacher access required' using errcode = '42501';
  end if;
  if p_limit <> 50 then
    raise exception 'Fetch limit must be 50' using errcode = '22023';
  end if;

  delete from public.fetch_llm_hourly_usage
  where window_start < current_window - interval '24 hours';

  insert into public.fetch_llm_hourly_usage(window_start, request_count, updated_at)
  values (current_window, 1, clock_timestamp())
  on conflict (window_start) do update
    set request_count = public.fetch_llm_hourly_usage.request_count + 1,
        updated_at = clock_timestamp()
    where public.fetch_llm_hourly_usage.request_count < p_limit
  returning request_count into claimed_count;

  retry_seconds := greatest(1, ceil(extract(epoch from current_window + interval '1 hour' - clock_timestamp()))::integer);
  if claimed_count is null then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', retry_seconds
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, p_limit - claimed_count),
    'retry_after_seconds', retry_seconds
  );
end;
$$;

revoke all on function public.teamup_claim_fetch_llm_request(integer)
  from public, anon, authenticated;
grant execute on function public.teamup_claim_fetch_llm_request(integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
