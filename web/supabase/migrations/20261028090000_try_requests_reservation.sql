-- Try it (POST /api/v1/try): one atomic reservation per request.
--
-- The route used to count this visitor's requests in the last hour and everyone's in the last day,
-- then insert a row. Two concurrent requests could both read the count before either insert, so a
-- burst from one IP got past the hourly cap of 6 (and a burst at 499 past the daily cap of 500).
-- reserve_try_request does the check and the insert in one transaction under one advisory lock, so
-- concurrent calls run the check one after the other, and each sees the rows the earlier ones wrote.
--
--   * try_requests already exists in production; no earlier migration created it. The create table,
--     create index and enable row level security statements below repeat production's definitions
--     exactly, so they change nothing there and give local and staging databases the same table.
--   * Only the API's service role uses the table. RLS (on, no policies) already blocks anon and
--     authenticated; their table and sequence grants are removed as well. The service role's
--     select/insert/sequence grants are restated so the function (security invoker) works on a
--     project whose default privileges don't reach service_role; production already has them.
--   * The function is callable by service_role only.
--   * Early refusal: the function first runs both counts without the lock and returns hour_cap or
--     day_cap if either cap is already reached. A capped visitor, or anyone once the day is capped,
--     never takes the lock, so a flood of refused requests doesn't queue on it while holding
--     connections from PostgREST's pool. Only calls that may insert (at most the day cap's worth a
--     day, plus a burst's losers) take the lock and recount under it.
--   * lock_timeout = 1s: a call that would wait more than a second for the lock fails with 55P03,
--     and the route answers 503, instead of holding a pooled connection behind a stuck holder.
--
-- Order: apply this migration first (after a backup), then deploy the API. Today's production code
-- keeps working once this is applied: it counts and inserts with the service role, whose rights are
-- unchanged. The new route code calls reserve_try_request and answers 503 until the function exists.
--
-- Rollback (deploy the previous API first; the table and its rows stay):
--   drop function if exists public.reserve_try_request(text, integer, integer);
--   notify pgrst, 'reload schema';

create table if not exists public.try_requests (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null
);
create index if not exists try_requests_ip_time_idx on public.try_requests (ip_hash, created_at desc);
create index if not exists try_requests_time_idx on public.try_requests (created_at desc);
alter table public.try_requests enable row level security;

revoke all on table public.try_requests from anon, authenticated;
revoke all on sequence public.try_requests_id_seq from anon, authenticated;
grant select, insert on table public.try_requests to service_role;
grant usage on sequence public.try_requests_id_seq to service_role;

-- Returns 'ok' (a row was recorded: the caller may answer), 'hour_cap' or 'day_cap' (nothing recorded).
create or replace function public.reserve_try_request(p_ip_hash text, p_ip_cap integer, p_day_cap integer)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
set lock_timeout = '1s'
as $$
declare
  v_mine bigint;
  v_all bigint;
begin
  -- The route sends HMAC-SHA256 truncated to 32 lowercase hex characters. Anything else, a null or a
  -- cap under 1 is a caller bug: refuse it rather than store a raw address or skip a cap.
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{32}$' then
    raise exception 'reserve_try_request: p_ip_hash must be 32 lowercase hex characters' using errcode = '22023';
  end if;
  if p_ip_cap is null or p_ip_cap < 1 or p_day_cap is null or p_day_cap < 1 then
    raise exception 'reserve_try_request: caps must be at least 1' using errcode = '22023';
  end if;

  -- The counts below must see rows committed by whoever held the lock before us. Under read committed
  -- each statement takes a fresh snapshot after the lock is granted; under repeatable read or
  -- serializable the snapshot dates from the transaction's first statement, before the lock, and
  -- would miss them. PostgREST runs RPCs in read committed by default.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'reserve_try_request: needs read committed, got %', current_setting('transaction_isolation')
      using errcode = '25000';
  end if;

  -- Early refusal, without the lock. Within one call now() is fixed (it's the transaction's start
  -- time) and rows are only ever added, so a count can't drop between here and the locked recount: a
  -- cap reached here is still reached under the lock. (A purge of day-old rows could at most refuse a
  -- request a moment early; it can never admit one.) Refusing here keeps capped visitors, and
  -- everyone once the day is capped, off the lock. A count under the cap proves nothing (others may
  -- be inserting), so those calls go on to the lock and the recount below, which is unchanged.
  select count(*) into v_mine
  from public.try_requests
  where ip_hash = p_ip_hash and created_at >= now() - interval '1 hour';
  if v_mine >= p_ip_cap then
    return 'hour_cap';
  end if;
  select count(*) into v_all
  from public.try_requests
  where created_at >= now() - interval '1 day';
  if v_all >= p_day_cap then
    return 'day_cap';
  end if;

  -- One lock for every reservation that may insert: the daily cap is global, so they all queue here.
  -- Held until the transaction ends, i.e. after this call's insert commits; lock_timeout (above)
  -- bounds the wait at 1 s. The key is a fixed int8 constant ('try_resv' as 8 ASCII bytes). The
  -- schema's other advisory keys are int4 hashtext() values (the gift functions), which it can't
  -- equal, and int8 hashtextextended() values (team workspaces, 20261022133000); a collision with
  -- one of those is about 2^-64 likely and would only make one call wait for the other.
  perform pg_advisory_xact_lock(8390902506592760694);

  -- This visitor's requests in the last hour (try_requests_ip_time_idx).
  select count(*) into v_mine
  from public.try_requests
  where ip_hash = p_ip_hash and created_at >= now() - interval '1 hour';
  if v_mine >= p_ip_cap then
    return 'hour_cap';
  end if;

  -- Everyone's requests in the last day (try_requests_time_idx).
  select count(*) into v_all
  from public.try_requests
  where created_at >= now() - interval '1 day';
  if v_all >= p_day_cap then
    return 'day_cap';
  end if;

  -- Under both caps: record this request before the caller spends a model call on it.
  insert into public.try_requests (ip_hash) values (p_ip_hash);
  return 'ok';
end;
$$;

revoke all on function public.reserve_try_request(text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_try_request(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
