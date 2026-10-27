-- Enterprise ($50 a month, monthly only) and Big Business ($5,000 once, stored as interval
-- 'lifetime') plans, and Pro's monthly explanations from 100 to 200.
-- Both new plans are one account (personal workspace, one seat), like Pro. Checkout and the webhook
-- only grant them while BILLING_NEW_TIERS_ENABLED is exactly `true` on the server.
-- The Pro update reaches every existing Pro row (promo, gift and welcome-month Pro included) the
-- moment this runs, so applying it to production is a separate owner decision.
-- Safe to run twice: every step drops or upserts what it adds.

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

-- 3. Seat rules: Enterprise and Big Business follow Pro (personal workspace, exactly one seat).
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
  if new.plan = 'business' and v_type <> 'personal' then raise exception 'Big Business requires a personal workspace'; end if;
  if new.plan = 'teams' and v_type <> 'team' then raise exception 'Teams requires a team workspace'; end if;
  if new.plan = 'pro' and new.seats <> 1 then raise exception 'Pro must have exactly one seat'; end if;
  if new.plan = 'enterprise' and new.seats <> 1 then raise exception 'Enterprise must have exactly one seat'; end if;
  if new.plan = 'business' and new.seats <> 1 then raise exception 'Big Business must have exactly one seat'; end if;
  if new.plan = 'teams' and new.seats < 2 then raise exception 'Teams requires at least two seats'; end if;
  if new.plan = 'teams' and new.seats < greatest(2,
    (select count(*) from workspace_members where workspace_id = new.workspace_id) +
    (select count(*) from workspace_invitations where workspace_id = new.workspace_id and status = 'pending' and expires_at > now())
  ) then raise exception 'Teams seats cannot be lower than occupied and pending seats'; end if;
  return new;
end;
$$;

-- 4. Caps a month. Must match BILLING_LIMITS in web/src/billing/plans.ts. Big Business's numbers are
--    its written fair-use limit (placeholder pending the owner's choice).
insert into plan_entitlements(plan, ai_explanations, active_projects, dictionary_items, saved_items, project_questions)
values
  ('enterprise', 1000, 25, 5000, 5000, 2500),
  ('business', 5000, 100, 20000, 20000, 10000)
on conflict (plan) do update set
  ai_explanations = excluded.ai_explanations,
  active_projects = excluded.active_projects,
  dictionary_items = excluded.dictionary_items,
  saved_items = excluded.saved_items,
  project_questions = excluded.project_questions,
  updated_at = now();

-- 5. Pro: 200 explanations a month (was 100).
update plan_entitlements set ai_explanations = 200, updated_at = now() where plan = 'pro' and ai_explanations <> 200;
