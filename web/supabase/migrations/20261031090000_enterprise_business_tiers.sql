-- Enterprise ($50 a month, monthly only) and Big Business ($5,000 once, stored as interval
-- 'lifetime') plans, and Pro's monthly explanations from 100 to 200.
-- Enterprise is one account (personal workspace, one seat), like Pro. Big Business is a team
-- workspace with exactly 10 named seats (owner, members and pending invitations) and unlimited
-- explanations and questions: a null cap in plan_entitlements, read as "no monthly cap" by
-- billing_overview and reserve_billing_usage. Its only limit is the fair-use rate limit per person
-- (consume_fair_use_rate_limit, on the request_rate_limits table). A member of an active Big Business
-- workspace is billed there by default. Checkout and the webhook only grant the new plans while
-- BILLING_NEW_TIERS_ENABLED is exactly `true` on the server.
-- The Pro update reaches every existing Pro row (promo, gift and welcome-month Pro included) the
-- moment this runs, so applying it to production is a separate owner decision.
-- Safe to run twice: every step drops or upserts what it adds.
--
-- Rollback of steps 6 to 9 (the rest is additive): re-run the previous definitions of
-- billing_overview (20260826090000_gifts_and_trialing_expiry.sql), reserve_billing_usage
-- (20261022124500_meter_named_workspace_only_on_teams.sql) and create_workspace_invitation
-- (20260909093000_teams_collab_history.sql) after setting the business caps back to numbers, then
--   drop function if exists public.consume_fair_use_rate_limit(text, integer, integer, integer, integer);

-- 1. Widen the three plan CHECKs. They are inline constraints with Postgres auto-names, so they are
--    found by definition (the plan list without 'enterprise') and replaced by named ones.
do $$
declare
  v_table text;
  v_name text;
begin
  foreach v_table in array array['plan_entitlements', 'subscriptions', 'checkout_intents'] loop
    for v_name in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = v_table
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%''pro''%''teams''%'
        and pg_get_constraintdef(con.oid) not ilike '%enterprise%'
    loop
      execute format('alter table %I drop constraint %I', v_table, v_name);
    end loop;
  end loop;
end $$;

alter table plan_entitlements drop constraint if exists plan_entitlements_plan_values_check;
alter table plan_entitlements add constraint plan_entitlements_plan_values_check
  check (plan in ('free', 'pro', 'teams', 'enterprise', 'business'));

alter table subscriptions drop constraint if exists subscriptions_plan_values_check;
alter table subscriptions add constraint subscriptions_plan_values_check
  check (plan in ('free', 'pro', 'teams', 'enterprise', 'business'));

alter table checkout_intents drop constraint if exists checkout_intents_plan_values_check;
alter table checkout_intents add constraint checkout_intents_plan_values_check
  check (plan in ('pro', 'teams', 'enterprise', 'business'));

-- 2. Intervals: Big Business is the one-time 'lifetime' interval only; Enterprise is monthly only.
--    No existing row carries either plan, so these hold for every row already stored.
alter table subscriptions drop constraint if exists subscriptions_new_tier_interval_check;
alter table subscriptions add constraint subscriptions_new_tier_interval_check
  check ((plan <> 'business' or interval = 'lifetime') and (plan <> 'enterprise' or interval = 'monthly'));

alter table checkout_intents drop constraint if exists checkout_intents_new_tier_interval_check;
alter table checkout_intents add constraint checkout_intents_new_tier_interval_check
  check ((plan <> 'business' or interval = 'lifetime') and (plan <> 'enterprise' or interval = 'monthly'));

-- 3. Seat rules: Enterprise follows Pro (personal workspace, exactly one seat). Big Business is a
--    team workspace with exactly 10 seats, never fewer than its members and pending invitations.
create or replace function validate_subscription_workspace()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_type text;
begin
  select type into strict v_type from workspaces where id = new.workspace_id;
  if new.plan = 'pro' and v_type <> 'personal' then raise exception 'Pro requires a personal workspace'; end if;
  if new.plan = 'enterprise' and v_type <> 'personal' then raise exception 'Enterprise requires a personal workspace'; end if;
  if new.plan = 'business' and v_type <> 'team' then raise exception 'Big Business requires a team workspace'; end if;
  if new.plan = 'teams' and v_type <> 'team' then raise exception 'Teams requires a team workspace'; end if;
  if new.plan = 'pro' and new.seats <> 1 then raise exception 'Pro must have exactly one seat'; end if;
  if new.plan = 'enterprise' and new.seats <> 1 then raise exception 'Enterprise must have exactly one seat'; end if;
  if new.plan = 'business' and new.seats <> 10 then raise exception 'Big Business must have exactly ten seats'; end if;
  if new.plan = 'teams' and new.seats < 2 then raise exception 'Teams requires at least two seats'; end if;
  if new.plan = 'teams' and new.seats < greatest(2,
    (select count(*) from workspace_members where workspace_id = new.workspace_id) +
    (select count(*) from workspace_invitations where workspace_id = new.workspace_id and status = 'pending' and expires_at > now())
  ) then raise exception 'Teams seats cannot be lower than occupied and pending seats'; end if;
  if new.plan = 'business' and new.seats < (
    (select count(*) from workspace_members where workspace_id = new.workspace_id) +
    (select count(*) from workspace_invitations where workspace_id = new.workspace_id and status = 'pending' and expires_at > now())
  ) then raise exception 'Big Business includes up to 10 named seats'; end if;
  return new;
end;
$$;

-- 4. Caps a month. Must match BILLING_LIMITS in web/src/billing/plans.ts. A null cap is unlimited
--    (no monthly cap); only Big Business's explanations and questions are null.
alter table plan_entitlements alter column ai_explanations drop not null;
alter table plan_entitlements alter column project_questions drop not null;
alter table plan_entitlements drop constraint if exists plan_entitlements_unlimited_business_only_check;
alter table plan_entitlements add constraint plan_entitlements_unlimited_business_only_check
  check (plan = 'business' or (ai_explanations is not null and project_questions is not null));
insert into plan_entitlements(plan, ai_explanations, active_projects, dictionary_items, saved_items, project_questions)
values
  ('enterprise', 1000, 25, 5000, 5000, 2500),
  ('business', null, 100, 20000, 20000, null)
on conflict (plan) do update set
  ai_explanations = excluded.ai_explanations,
  active_projects = excluded.active_projects,
  dictionary_items = excluded.dictionary_items,
  saved_items = excluded.saved_items,
  project_questions = excluded.project_questions,
  updated_at = now();

-- 5. Pro: 200 explanations a month (was 100).
update plan_entitlements set ai_explanations = 200, updated_at = now() where plan = 'pro' and ai_explanations <> 200;

-- 6. billing_overview: a null cap stays null (`remaining` too: greatest() would turn it into 0), and
--    with no workspace named, a member of an active Big Business workspace (owner or named seat) is
--    shown, and billed, there; anyone else gets their personal workspace as before. Otherwise as in
--    20260826090000_gifts_and_trialing_expiry.sql.
create or replace function billing_overview(p_user_id uuid, p_workspace_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace record;
  v_subscription subscriptions%rowtype;
  v_plan text;
  v_occupied integer;
  v_pending integer;
  v_usage jsonb;
  v_period_start date := date_trunc('month', now() at time zone 'utc')::date;
  v_resets_at timestamptz := (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';
begin
  if p_workspace_id is null then
    select s.workspace_id into p_workspace_id
    from subscriptions s join workspace_members wm on wm.workspace_id = s.workspace_id
    where wm.user_id = p_user_id and s.plan = 'business' and s.status = 'active'
    order by wm.joined_at, s.workspace_id
    limit 1;
    if p_workspace_id is null then p_workspace_id := ensure_personal_workspace(p_user_id); end if;
  end if;
  select w.id, w.name, w.type, w.owner_user_id, wm.role into strict v_workspace
  from workspaces w join workspace_members wm on wm.workspace_id = w.id
  where w.id = p_workspace_id and wm.user_id = p_user_id;
  select * into strict v_subscription from subscriptions where workspace_id = p_workspace_id;

  v_plan := case
    when v_subscription.status = 'trialing' and v_subscription.current_period_end is not null and v_subscription.current_period_end <= now() then 'free'
    when v_subscription.plan = 'free' then 'free'
    when v_subscription.status in ('trialing','active') then v_subscription.plan
    when v_subscription.status = 'grace_period' and v_subscription.grace_period_ends_at > now() then v_subscription.plan
    else 'free'
  end;
  select count(*)::integer into v_occupied from workspace_members where workspace_id = p_workspace_id;
  select count(*)::integer into v_pending from workspace_invitations where workspace_id = p_workspace_id and status = 'pending' and expires_at > now();

  select jsonb_agg(jsonb_build_object(
    'kind', kinds.kind,
    'used', coalesce(um.used, 0),
    'limit', lim.cap,
    'remaining', case when lim.cap is null then null else greatest(0, lim.cap - coalesce(um.used, 0)) end,
    'resets_at', v_resets_at
  )) into v_usage
  from (values ('ai_explanation'), ('project_question'), ('indexed_project'), ('dictionary_item'), ('saved_item')) kinds(kind)
  cross join lateral (select billing_limit(v_plan, kinds.kind, v_subscription.seats) as cap) lim
  left join usage_monthly um on um.workspace_id = p_workspace_id and um.kind = kinds.kind and um.period_start = v_period_start;

  return jsonb_build_object(
    'workspace', jsonb_build_object('id', v_workspace.id, 'name', v_workspace.name, 'type', v_workspace.type, 'role', v_workspace.role, 'owner_user_id', v_workspace.owner_user_id),
    'subscription', jsonb_build_object(
      'workspace_id', v_subscription.workspace_id, 'plan', v_plan, 'interval', v_subscription.interval, 'status', v_subscription.status,
      'seats', v_subscription.seats, 'stripe_customer_id', v_subscription.stripe_customer_id,
      'stripe_subscription_id', v_subscription.stripe_subscription_id, 'stripe_price_id', v_subscription.stripe_price_id,
      'current_period_start', v_subscription.current_period_start, 'current_period_end', v_subscription.current_period_end, 'grace_period_ends_at', v_subscription.grace_period_ends_at,
      'cancel_at_period_end', v_subscription.cancel_at_period_end
    ),
    'usage', v_usage,
    'occupied_seats', v_occupied,
    'pending_invitations', v_pending,
    'minimum_billable_seats', case when v_workspace.type = 'team' then greatest(2, v_occupied + v_pending) else 1 end,
    'can_manage_billing', v_workspace.role = 'owner',
    'can_manage_members', v_workspace.role in ('owner','admin')
  );
exception when no_data_found then
  raise exception 'Workspace not found or access denied';
end;
$$;

-- 7. reserve_billing_usage: a null cap (unlimited) always reserves; a named workspace pays while its
--    effective plan is Teams or Big Business. Otherwise as in
--    20261022124500_meter_named_workspace_only_on_teams.sql.
create or replace function public.reserve_billing_usage(p_user_id uuid, p_kind text, p_workspace_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_overview jsonb;
  v_workspace_id uuid;
  v_line jsonb;
  v_limit integer;
  v_used integer;
  v_period_start date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if p_kind not in ('ai_explanation','project_question','indexed_project','dictionary_item','saved_item') then raise exception 'Unknown usage kind'; end if;
  v_overview := billing_overview(p_user_id, p_workspace_id);
  if p_workspace_id is not null and coalesce(v_overview #>> '{subscription,plan}', '') not in ('teams', 'business') then
    v_overview := billing_overview(p_user_id, null);
  end if;
  v_workspace_id := (v_overview #>> '{workspace,id}')::uuid;
  select value into strict v_line from jsonb_array_elements(v_overview->'usage') where value->>'kind' = p_kind;
  v_limit := (v_line->>'limit')::integer;

  insert into usage_monthly(workspace_id, kind, period_start, used)
  values (v_workspace_id, p_kind, v_period_start, 1)
  on conflict (workspace_id, kind, period_start) do update
    set used = usage_monthly.used + 1, updated_at = now()
    where v_limit is null or usage_monthly.used + 1 <= v_limit
  returning used into v_used;

  if v_used is null or (v_limit is not null and v_used > v_limit) then
    return jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'line', v_line);
  end if;

  insert into usage_events(workspace_id, user_id, kind, quantity) values (v_workspace_id, p_user_id, p_kind, 1);
  v_line := jsonb_set(jsonb_set(v_line, '{used}', to_jsonb(v_used)), '{remaining}',
    case when v_limit is null then 'null'::jsonb else to_jsonb(greatest(0, v_limit - v_used)) end);
  return jsonb_build_object('allowed', true, 'line', v_line);
end;
$$;

-- 8. create_workspace_invitation: Big Business seats cannot be bought, so its refusal says how to
--    free one (same text as BUSINESS_SEATS_FULL in web/src/billing/plans.ts). A seat is named: it
--    frees only when its member is removed or the invitation is revoked or expires. Otherwise as in
--    20260909093000_teams_collab_history.sql.
create or replace function create_workspace_invitation(
  p_user_id uuid, p_workspace_id uuid, p_email text, p_role text, p_token_hash text, p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_row workspace_invitations%rowtype; v_overview jsonb;
begin
  if p_role not in ('admin','member') then raise exception 'Invalid invitation role'; end if;
  if not exists (select 1 from workspace_members wm join workspaces w on w.id = wm.workspace_id where wm.workspace_id = p_workspace_id and wm.user_id = p_user_id and wm.role in ('owner','admin') and w.type = 'team') then
    raise exception 'Only team owners and admins can invite members';
  end if;
  perform 1 from subscriptions where workspace_id = p_workspace_id for update;
  update workspace_invitations set status = 'expired'
    where workspace_id = p_workspace_id and email = lower(trim(p_email)) and status = 'pending' and expires_at <= now();
  v_overview := billing_overview(p_user_id, p_workspace_id);
  if (v_overview->>'occupied_seats')::integer + (v_overview->>'pending_invitations')::integer >= (v_overview #>> '{subscription,seats}')::integer then
    if (v_overview #>> '{subscription,plan}') = 'business' then
      raise exception 'Big Business includes up to 10 named seats. Remove someone from the workspace to free a seat.';
    end if;
    raise exception 'Add a seat before sending another invitation';
  end if;
  insert into workspace_invitations(workspace_id, email, role, token_hash, invited_by, expires_at)
  values (p_workspace_id, lower(trim(p_email)), p_role, p_token_hash, p_user_id, p_expires_at) returning * into v_row;
  return to_jsonb(v_row) - 'token_hash';
end;
$$;

-- 9. The fair-use rate limit, per person, for unlimited allowances: p_per_minute and p_per_hour
--    requests and p_characters_per_hour characters sent, in fixed windows, on request_rate_limits
--    (rows "<bucket>:minute|hour|characters"; the bucket is a hash, never a raw id). A request is
--    counted only when every limit allows it; a refused one counts nothing. Returns
--    {allowed, window, retry_after_seconds, alert}: alert is true for the first hourly refusal of the
--    bucket in that hour (row "<bucket>:alerted"), so the app logs one alert per person per hour.
--    Rows for one bucket are locked in a fixed order, so concurrent requests of one person queue.
create or replace function public.consume_fair_use_rate_limit(
  p_bucket text,
  p_characters integer,
  p_per_minute integer,
  p_per_hour integer,
  p_characters_per_hour integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_minute timestamptz;
  v_hour timestamptz;
  v_minute_hits integer;
  v_hour_hits integer;
  v_hour_characters integer;
  v_alert boolean;
begin
  if p_bucket is null or length(p_bucket) not between 1 and 180
     or p_characters is null or p_characters < 0
     or p_per_minute is null or p_per_minute < 1
     or p_per_hour is null or p_per_hour < 1
     or p_characters_per_hour is null or p_characters_per_hour < 1 then
    raise exception 'invalid rate limit arguments';
  end if;
  v_minute := to_timestamp(floor(extract(epoch from v_now) / 60) * 60);
  v_hour := to_timestamp(floor(extract(epoch from v_now) / 3600) * 3600);

  insert into public.request_rate_limits(bucket, window_start, hits)
  values (p_bucket || ':minute', v_minute, 0), (p_bucket || ':hour', v_hour, 0), (p_bucket || ':characters', v_hour, 0)
  on conflict (bucket, window_start) do nothing;
  select hits into strict v_minute_hits from public.request_rate_limits where bucket = p_bucket || ':minute' and window_start = v_minute for update;
  select hits into strict v_hour_hits from public.request_rate_limits where bucket = p_bucket || ':hour' and window_start = v_hour for update;
  select hits into strict v_hour_characters from public.request_rate_limits where bucket = p_bucket || ':characters' and window_start = v_hour for update;

  if v_hour_hits >= p_per_hour or v_hour_characters + p_characters > p_characters_per_hour then
    insert into public.request_rate_limits(bucket, window_start, hits) values (p_bucket || ':alerted', v_hour, 1)
    on conflict (bucket, window_start) do nothing;
    v_alert := found;
    return jsonb_build_object('allowed', false, 'window', 'hour', 'alert', v_alert,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_hour + interval '1 hour' - v_now)))::integer));
  end if;
  if v_minute_hits >= p_per_minute then
    return jsonb_build_object('allowed', false, 'window', 'minute', 'alert', false,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_minute + interval '1 minute' - v_now)))::integer));
  end if;

  update public.request_rate_limits set hits = hits + 1 where bucket = p_bucket || ':minute' and window_start = v_minute;
  update public.request_rate_limits set hits = hits + 1 where bucket = p_bucket || ':hour' and window_start = v_hour;
  update public.request_rate_limits set hits = hits + p_characters where bucket = p_bucket || ':characters' and window_start = v_hour;

  -- Occasional cleanup keeps the table small without a scheduled job (as consume_rate_limit does).
  if random() < 0.01 then
    delete from public.request_rate_limits where window_start < now() - interval '1 day';
  end if;
  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.consume_fair_use_rate_limit(text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_fair_use_rate_limit(text, integer, integer, integer, integer) to service_role;
