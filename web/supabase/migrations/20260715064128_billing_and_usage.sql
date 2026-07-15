-- Billing configuration and server-side AI explanation accounting.
-- Prices live in application configuration; this table records entitlement state received
-- from the billing provider. No payment provider key is stored in Postgres.

create extension if not exists pgcrypto;

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plan_id text not null check (plan_id in ('private_beta', 'pro', 'team', 'professional')),
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled')),
  seat_count integer not null default 1 check (seat_count > 0),
  provider_customer_id text unique,
  provider_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_one_active_per_user_idx
  on subscriptions(user_id)
  where status in ('active', 'trialing', 'past_due');

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind = 'explanation'),
  status text not null check (status in ('reserved', 'completed')),
  period_start date not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, request_id)
);

create index if not exists ai_usage_user_period_idx
  on ai_usage(user_id, period_start, status);

alter table subscriptions enable row level security;
alter table ai_usage enable row level security;

-- Billing and usage are backend-only. There are intentionally no client policies.
-- The service role reaches these tables through the API server, never an Electron renderer.

create or replace function public.reserve_explanation_usage(
  p_user_id uuid,
  p_request_id uuid,
  p_limit integer
)
returns table (allowed boolean, used_count integer, limit_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start date := date_trunc('month', now() at time zone 'UTC')::date;
  v_used_count integer;
begin
  if p_limit < 0 then
    raise exception 'p_limit must be non-negative';
  end if;

  select count(*)::integer into v_used_count
  from ai_usage
  where user_id = p_user_id
    and period_start = v_period_start
    and (
      status = 'completed'
      or (status = 'reserved' and created_at > now() - interval '15 minutes')
    );

  if exists (
    select 1 from ai_usage where user_id = p_user_id and request_id = p_request_id
  ) then
    return query select true, v_used_count, p_limit;
    return;
  end if;

  if v_used_count >= p_limit then
    return query select false, v_used_count, p_limit;
    return;
  end if;

  insert into ai_usage (user_id, request_id, kind, status, period_start)
  values (p_user_id, p_request_id, 'explanation', 'reserved', v_period_start);

  return query select true, v_used_count + 1, p_limit;
end;
$$;

create or replace function public.complete_explanation_usage(
  p_user_id uuid,
  p_request_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update ai_usage
  set status = 'completed', completed_at = now()
  where user_id = p_user_id
    and request_id = p_request_id
    and status = 'reserved';
$$;

create or replace function public.release_explanation_usage(
  p_user_id uuid,
  p_request_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from ai_usage
  where user_id = p_user_id
    and request_id = p_request_id
    and status = 'reserved';
$$;

revoke all on function public.reserve_explanation_usage(uuid, uuid, integer) from public;
revoke all on function public.complete_explanation_usage(uuid, uuid) from public;
revoke all on function public.release_explanation_usage(uuid, uuid) from public;
grant execute on function public.reserve_explanation_usage(uuid, uuid, integer) to service_role;
grant execute on function public.complete_explanation_usage(uuid, uuid) to service_role;
grant execute on function public.release_explanation_usage(uuid, uuid) to service_role;
