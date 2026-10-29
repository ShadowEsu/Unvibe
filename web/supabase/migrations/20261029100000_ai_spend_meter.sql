-- Hard spend stops for the hosted AI (Anthropic, Claude Haiku 5.5): $1 per UTC day and $20 in
-- total (BOSS ledger 339; Money confirmed the caps). The API reserves each call's worst case
-- before the request leaves and settles it from the measured usage afterwards
-- (web/src/ai/spendMeter.ts). Amounts are integer nano-dollars (1e-9 USD).
-- One row per meter per UTC day; counts only, never prompts, code, answers or user ids.
-- Public roles have no table or function access; the API uses the service-role key.
--
-- Rollback:
--   drop function if exists public.settle_ai_spend(text, date, bigint);
--   drop function if exists public.reserve_ai_spend(text, bigint, bigint, bigint);
--   drop table if exists public.ai_spend_days;

create table if not exists public.ai_spend_days (
  meter    text    not null check (meter in ('anthropic')),
  day      date    not null,
  nano_usd bigint  not null default 0 check (nano_usd >= 0),
  calls    integer not null default 0 check (calls >= 0),
  primary key (meter, day)
);

alter table public.ai_spend_days enable row level security;

-- Counts p_nano_usd against today (UTC) and the meter's all-time total, or refuses when either
-- stop would be passed. Reservations for one meter run one at a time under an advisory lock, so
-- a burst can't all read the same total. Returns status 'ok' with the UTC day it was counted on,
-- or 'day_cap' / 'total_cap' with nothing counted.
create or replace function public.reserve_ai_spend(
  p_meter text,
  p_nano_usd bigint,
  p_day_cap bigint,
  p_total_cap bigint
)
returns table (status text, day date)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_today bigint;
  v_total bigint;
begin
  if p_meter is null or p_meter not in ('anthropic')
     or p_nano_usd is null or p_nano_usd < 0
     or p_day_cap is null or p_day_cap < 1
     or p_total_cap is null or p_total_cap < 1 then
    raise exception 'invalid ai spend arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_spend:' || p_meter));

  select coalesce(sum(d.nano_usd), 0),
         coalesce(sum(d.nano_usd) filter (where d.day = v_day), 0)
    into v_total, v_today
    from public.ai_spend_days d
   where d.meter = p_meter;

  if v_total + p_nano_usd > p_total_cap then
    return query select 'total_cap'::text, v_day;
    return;
  end if;
  if v_today + p_nano_usd > p_day_cap then
    return query select 'day_cap'::text, v_day;
    return;
  end if;
  -- The conflict target names the constraint: the output column "day" would make "(meter, day)" ambiguous.
  insert into public.ai_spend_days as s (meter, day, nano_usd, calls)
  values (p_meter, v_day, p_nano_usd, 1)
  on conflict on constraint ai_spend_days_pkey
  do update set nano_usd = s.nano_usd + excluded.nano_usd, calls = s.calls + 1;

  return query select 'ok'::text, v_day;
end;
$$;

-- Moves a reservation to the measured cost: p_delta_nano_usd is measured minus reserved, so it is
-- usually negative. The day never goes below zero. Same lock as reserve_ai_spend.
create or replace function public.settle_ai_spend(
  p_meter text,
  p_day date,
  p_delta_nano_usd bigint
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_meter is null or p_meter not in ('anthropic') or p_day is null or p_delta_nano_usd is null then
    raise exception 'invalid ai spend arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_spend:' || p_meter));

  update public.ai_spend_days
     set nano_usd = greatest(0, nano_usd + p_delta_nano_usd)
   where meter = p_meter and day = p_day;
end;
$$;

revoke all on table public.ai_spend_days from public, anon, authenticated;
revoke all on function public.reserve_ai_spend(text, bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.settle_ai_spend(text, date, bigint) from public, anon, authenticated;
-- Both functions are security invoker, so the service role needs the table rights they use.
grant select, insert, update on table public.ai_spend_days to service_role;
grant execute on function public.reserve_ai_spend(text, bigint, bigint, bigint) to service_role;
grant execute on function public.settle_ai_spend(text, date, bigint) to service_role;
