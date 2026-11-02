-- Per-account daily share of the hosted AI budget (BOSS 2026-11-02, after Security SHOULD-O7): one
-- account may spend at most $1 per UTC day (a fifth of the $5 day guard), so a few maximum-size
-- reviews from one account can't use up the day for everyone. "Account" is a signed-in user or a
-- trial install; the API sends only a SHA-256 hash of it, never the id itself. The website's Try box
-- has no account and keeps its own per-IP limits. Same lock and nano-dollar amounts as
-- 20261102090000; the meter-wide day and month totals stay in ai_spend_days.
--
-- Rollback:
--   drop function if exists public.settle_ai_spend_account(text, date, text, bigint);
--   drop function if exists public.reserve_ai_spend_account(text, text, bigint, bigint, bigint, bigint);
--   drop table if exists public.ai_spend_account_days;

create table if not exists public.ai_spend_account_days (
  meter        text    not null check (meter in ('anthropic')),
  day          date    not null,
  account_hash text    not null check (account_hash ~ '^[0-9a-f]{64}$'),
  nano_usd     bigint  not null default 0 check (nano_usd >= 0),
  primary key (meter, day, account_hash)
);

alter table public.ai_spend_account_days enable row level security;

-- Counts p_nano_usd against this UTC month, today, and the account's today, or refuses when any
-- stop would be passed. Returns status 'ok' with the UTC day it was counted on, or 'month_cap' /
-- 'day_cap' / 'account_day_cap' with nothing counted.
create or replace function public.reserve_ai_spend_account(
  p_meter text,
  p_account_hash text,
  p_nano_usd bigint,
  p_day_cap bigint,
  p_month_cap bigint,
  p_account_day_cap bigint
)
returns table (status text, day date)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_month_start date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_today bigint;
  v_month bigint;
  v_account bigint;
begin
  if p_meter is null or p_meter not in ('anthropic')
     or p_account_hash is null or p_account_hash !~ '^[0-9a-f]{64}$'
     or p_nano_usd is null or p_nano_usd < 0
     or p_day_cap is null or p_day_cap < 1
     or p_month_cap is null or p_month_cap < 1
     or p_account_day_cap is null or p_account_day_cap < 1 then
    raise exception 'invalid ai spend arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_spend:' || p_meter));

  select coalesce(sum(d.nano_usd), 0),
         coalesce(sum(d.nano_usd) filter (where d.day = v_day), 0)
    into v_month, v_today
    from public.ai_spend_days d
   where d.meter = p_meter
     and d.day >= v_month_start;

  select coalesce(sum(a.nano_usd), 0)
    into v_account
    from public.ai_spend_account_days a
   where a.meter = p_meter and a.day = v_day and a.account_hash = p_account_hash;

  if v_month + p_nano_usd > p_month_cap then
    return query select 'month_cap'::text, v_day;
    return;
  end if;
  if v_today + p_nano_usd > p_day_cap then
    return query select 'day_cap'::text, v_day;
    return;
  end if;
  if v_account + p_nano_usd > p_account_day_cap then
    return query select 'account_day_cap'::text, v_day;
    return;
  end if;

  insert into public.ai_spend_days as s (meter, day, nano_usd, calls)
  values (p_meter, v_day, p_nano_usd, 1)
  on conflict on constraint ai_spend_days_pkey
  do update set nano_usd = s.nano_usd + excluded.nano_usd, calls = s.calls + 1;

  insert into public.ai_spend_account_days as a (meter, day, account_hash, nano_usd)
  values (p_meter, v_day, p_account_hash, p_nano_usd)
  on conflict on constraint ai_spend_account_days_pkey
  do update set nano_usd = a.nano_usd + excluded.nano_usd;

  return query select 'ok'::text, v_day;
end;
$$;

-- Moves a reservation to the measured cost on both the meter's day and the account's day (usually a
-- negative delta). Neither goes below zero. Same lock as the reserve functions.
create or replace function public.settle_ai_spend_account(
  p_meter text,
  p_day date,
  p_account_hash text,
  p_delta_nano_usd bigint
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_meter is null or p_meter not in ('anthropic') or p_day is null or p_delta_nano_usd is null
     or p_account_hash is null or p_account_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid ai spend arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_spend:' || p_meter));

  update public.ai_spend_days
     set nano_usd = greatest(0, nano_usd + p_delta_nano_usd)
   where meter = p_meter and day = p_day;

  update public.ai_spend_account_days
     set nano_usd = greatest(0, nano_usd + p_delta_nano_usd)
   where meter = p_meter and day = p_day and account_hash = p_account_hash;
end;
$$;

revoke all on table public.ai_spend_account_days from public, anon, authenticated;
revoke all on function public.reserve_ai_spend_account(text, text, bigint, bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.settle_ai_spend_account(text, date, text, bigint) from public, anon, authenticated;

-- Both functions are security invoker, so the service role needs the table rights they use.
grant select, insert, update on table public.ai_spend_account_days to service_role;
grant execute on function public.reserve_ai_spend_account(text, text, bigint, bigint, bigint, bigint) to service_role;
grant execute on function public.settle_ai_spend_account(text, date, text, bigint) to service_role;
