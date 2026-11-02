-- Monthly budget for the hosted AI (Preston 2026-11-02, via BOSS): the Anthropic key may spend $50 per
-- calendar month, of which Unvibe's share is $25, with a per-day guard of $5 (a fifth of the month), so
-- one bad day can't burn the month. This replaces the all-time $20 stop: the month restarts on the 1st
-- (UTC). Same table, same lock and same settle function as 20261029100000; amounts are nano-dollars.
--
-- reserve_ai_spend (all-time total) stays until no deployment calls it; drop it in a later migration.
--
-- Rollback:
--   drop function if exists public.reserve_ai_spend_month(text, bigint, bigint, bigint);

-- Counts p_nano_usd against today (UTC) and this UTC calendar month, or refuses when either stop
-- would be passed. Returns status 'ok' with the UTC day it was counted on, or 'day_cap' /
-- 'month_cap' with nothing counted.
create or replace function public.reserve_ai_spend_month(
  p_meter text,
  p_nano_usd bigint,
  p_day_cap bigint,
  p_month_cap bigint
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
begin
  if p_meter is null or p_meter not in ('anthropic')
     or p_nano_usd is null or p_nano_usd < 0
     or p_day_cap is null or p_day_cap < 1
     or p_month_cap is null or p_month_cap < 1 then
    raise exception 'invalid ai spend arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_spend:' || p_meter));

  select coalesce(sum(d.nano_usd), 0),
         coalesce(sum(d.nano_usd) filter (where d.day = v_day), 0)
    into v_month, v_today
    from public.ai_spend_days d
   where d.meter = p_meter
     and d.day >= v_month_start;

  if v_month + p_nano_usd > p_month_cap then
    return query select 'month_cap'::text, v_day;
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

revoke all on function public.reserve_ai_spend_month(text, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.reserve_ai_spend_month(text, bigint, bigint, bigint) to service_role;
