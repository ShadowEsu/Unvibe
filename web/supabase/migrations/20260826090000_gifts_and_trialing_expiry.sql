-- Gift claims (1 month of Pro each, max 5 per giver) plus expiry of complimentary trialing.

create table if not exists gift_claims (
  id uuid primary key default gen_random_uuid(),
  giver_email text not null,
  receiver_email text not null,
  promo_code text not null,
  created_at timestamptz not null default now(),
  unique (giver_email, receiver_email)
);
create index if not exists gift_claims_giver_idx on gift_claims (giver_email);
create index if not exists gift_claims_code_idx on gift_claims (promo_code);

alter table gift_claims enable row level security;

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
  if p_workspace_id is null then p_workspace_id := ensure_personal_workspace(p_user_id); end if;
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
    'limit', billing_limit(v_plan, kinds.kind, v_subscription.seats),
    'remaining', greatest(0, billing_limit(v_plan, kinds.kind, v_subscription.seats) - coalesce(um.used, 0)),
    'resets_at', v_resets_at
  )) into v_usage
  from (values ('ai_explanation'), ('project_question'), ('indexed_project'), ('dictionary_item'), ('saved_item')) kinds(kind)
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

create or replace function grant_gift_month(p_user_id uuid, p_ends_at timestamptz)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_subscription subscriptions%rowtype;
  v_end timestamptz;
begin
  v_workspace_id := ensure_personal_workspace(p_user_id);
  select * into strict v_subscription from subscriptions where workspace_id = v_workspace_id;
  if v_subscription.stripe_subscription_id is not null and v_subscription.status in ('active', 'trialing') then
    return false;
  end if;
  v_end := p_ends_at;
  if v_subscription.current_period_end is not null and v_subscription.current_period_end > v_end then
    v_end := v_subscription.current_period_end;
  end if;
  update subscriptions
    set plan = 'pro',
        interval = 'monthly',
        status = 'trialing',
        seats = 1,
        current_period_start = now(),
        current_period_end = v_end,
        updated_at = now()
    where workspace_id = v_workspace_id;
  return true;
end;
$$;
