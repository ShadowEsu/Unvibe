-- Quick look ("preview") allowance for the D5 Unvibe button (Security 2026-11-11, "PR 1: preview
-- allowance"). A preview is a short hosted-AI call (at most 400 output tokens). It reserves and settles
-- through the meter's existing functions like every other call (reserve_ai_spend_account and
-- settle_ai_spend_account, so it counts against the $10 day, the $35 month and the $1 per account day),
-- and just before that reservation it must also pass two checks of its own, counted here:
--   - at most $2 of preview spend per UTC day for everyone (ai_spend_kind_days);
--   - at most 20 previews per account per UTC day (ai_spend_kind_account_days), keyed on the same
--     SHA-256 account hash as ai_spend_account_days (a signed-in user or a trial install).
-- Explanations never call these functions, so they never draw on the preview budget, and a refused
-- preview counts nowhere. The caps live in web/src/ai/spendMeter.ts and arrive as arguments, as for
-- the meter's other functions. Amounts are integer nano-dollars (1e-9 USD); counts only, never
-- prompts, code, answers or ids.
--
-- Additive only: two new tables and two new functions. No existing table, column, function or row
-- changes, and nothing is backfilled. The kind is text with a CHECK (no enum type), so the rollback is
-- a plain drop. Public roles have no table or function access; the API uses the service-role key.
--
-- Rollback (drops only what this migration adds; what earlier previews spent stays counted in
-- ai_spend_days and ai_spend_account_days, which this migration never touches):
--   drop function if exists public.settle_ai_spend_kind(text, text, date, text, bigint, boolean);
--   drop function if exists public.reserve_ai_spend_kind(text, text, text, bigint, bigint, integer);
--   drop table if exists public.ai_spend_kind_account_days;
--   drop table if exists public.ai_spend_kind_days;

-- New tables only, so nothing here waits on a lock another query holds; fail fast if it ever does.
set local lock_timeout = '5s';

-- One row per meter, kind and UTC day: the kind's spend (reserved, then settled) and its call count.
create table if not exists public.ai_spend_kind_days (
  meter    text    not null check (meter in ('anthropic')),
  kind     text    not null check (kind in ('ai_preview')),
  day      date    not null,
  nano_usd bigint  not null default 0 check (nano_usd >= 0),
  calls    integer not null default 0 check (calls >= 0),
  primary key (meter, kind, day)
);

-- One row per meter, kind, UTC day and account: how many calls of that kind the account made.
create table if not exists public.ai_spend_kind_account_days (
  meter        text    not null check (meter in ('anthropic')),
  kind         text    not null check (kind in ('ai_preview')),
  day          date    not null,
  account_hash text    not null check (account_hash ~ '^[0-9a-f]{64}$'),
  calls        integer not null default 0 check (calls >= 0),
  primary key (meter, kind, day, account_hash)
);

alter table public.ai_spend_kind_days enable row level security;
alter table public.ai_spend_kind_account_days enable row level security;

-- Counts one call and p_nano_usd against the kind's day budget and the account's daily count, or
-- refuses when either would be passed. Returns status 'ok' with the UTC day it was counted on, or
-- 'kind_day_cap' / 'kind_account_calls' with nothing counted. The meter's own caps are not checked
-- here: the API calls reserve_ai_spend_account right after, and gives this back (settle with
-- p_release) when that refuses. Same lock as the meter's other functions.
create or replace function public.reserve_ai_spend_kind(
  p_meter text,
  p_kind text,
  p_account_hash text,
  p_nano_usd bigint,
  p_kind_day_cap bigint,
  p_account_day_calls integer
)
returns table (status text, day date)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_kind_today bigint;
  v_account_calls integer;
begin
  if p_meter is null or p_meter not in ('anthropic')
     or p_kind is null or p_kind not in ('ai_preview')
     or p_account_hash is null or p_account_hash !~ '^[0-9a-f]{64}$'
     or p_nano_usd is null or p_nano_usd < 0
     or p_kind_day_cap is null or p_kind_day_cap < 1
     or p_account_day_calls is null or p_account_day_calls < 1 then
    raise exception 'invalid ai spend arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_spend:' || p_meter));

  select coalesce(sum(k.nano_usd), 0)
    into v_kind_today
    from public.ai_spend_kind_days k
   where k.meter = p_meter and k.kind = p_kind and k.day = v_day;

  select coalesce(sum(a.calls), 0)
    into v_account_calls
    from public.ai_spend_kind_account_days a
   where a.meter = p_meter and a.kind = p_kind and a.day = v_day and a.account_hash = p_account_hash;

  if v_kind_today + p_nano_usd > p_kind_day_cap then
    return query select 'kind_day_cap'::text, v_day;
    return;
  end if;
  if v_account_calls + 1 > p_account_day_calls then
    return query select 'kind_account_calls'::text, v_day;
    return;
  end if;

  -- The conflict targets name the constraints: the output column "day" would make a column list ambiguous.
  insert into public.ai_spend_kind_days as k (meter, kind, day, nano_usd, calls)
  values (p_meter, p_kind, v_day, p_nano_usd, 1)
  on conflict on constraint ai_spend_kind_days_pkey
  do update set nano_usd = k.nano_usd + excluded.nano_usd, calls = k.calls + 1;

  insert into public.ai_spend_kind_account_days as a (meter, kind, day, account_hash, calls)
  values (p_meter, p_kind, v_day, p_account_hash, 1)
  on conflict on constraint ai_spend_kind_account_days_pkey
  do update set calls = a.calls + 1;

  return query select 'ok'::text, v_day;
end;
$$;

-- Moves a kind reservation to the measured cost (p_delta_nano_usd is measured minus reserved, so
-- usually negative). With p_release (nothing was sent, or the provider refused it unbilled) the call
-- is also given back to the day's and the account's counts. Nothing goes below zero. Same lock.
create or replace function public.settle_ai_spend_kind(
  p_meter text,
  p_kind text,
  p_day date,
  p_account_hash text,
  p_delta_nano_usd bigint,
  p_release boolean
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_meter is null or p_meter not in ('anthropic')
     or p_kind is null or p_kind not in ('ai_preview')
     or p_day is null or p_delta_nano_usd is null or p_release is null
     or p_account_hash is null or p_account_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid ai spend arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_spend:' || p_meter));

  update public.ai_spend_kind_days
     set nano_usd = greatest(0, nano_usd + p_delta_nano_usd),
         calls = case when p_release then greatest(0, calls - 1) else calls end
   where meter = p_meter and kind = p_kind and day = p_day;

  if p_release then
    update public.ai_spend_kind_account_days
       set calls = greatest(0, calls - 1)
     where meter = p_meter and kind = p_kind and day = p_day and account_hash = p_account_hash;
  end if;
end;
$$;

revoke all on table public.ai_spend_kind_days from public, anon, authenticated;
revoke all on table public.ai_spend_kind_account_days from public, anon, authenticated;
revoke all on function public.reserve_ai_spend_kind(text, text, text, bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.settle_ai_spend_kind(text, text, date, text, bigint, boolean) from public, anon, authenticated;

-- Both functions are security invoker, so the service role needs the table rights they use.
grant select, insert, update on table public.ai_spend_kind_days to service_role;
grant select, insert, update on table public.ai_spend_kind_account_days to service_role;
grant execute on function public.reserve_ai_spend_kind(text, text, text, bigint, bigint, integer) to service_role;
grant execute on function public.settle_ai_spend_kind(text, text, date, text, bigint, boolean) to service_role;
