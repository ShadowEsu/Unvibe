-- Cloud explanation metering. Learning records, saved material, and comprehension remain free;
-- this is only an idempotent allowance ledger for server-generated explanations.

create table if not exists subscriptions (
  user_id uuid primary key references users(id) on delete cascade,
  plan_id text not null default 'private_beta' check (plan_id in ('private_beta', 'pro', 'team', 'professional')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  updated_at timestamptz not null default now()
);

create table if not exists explanation_usage (
  user_id uuid not null references users(id) on delete cascade,
  request_id uuid not null,
  period_start timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create unique index if not exists explanation_usage_request_id_idx on explanation_usage(request_id);
create index if not exists explanation_usage_period_idx on explanation_usage(user_id, period_start);

-- The lock turns a quota check + insert into one atomic operation. Reusing a request UUID is
-- always successful for the original user, which makes client retries idempotent.
create or replace function reserve_explanation(
  p_user_id uuid,
  p_request_id uuid,
  p_period_start timestamptz,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_owner uuid;
  current_count integer;
begin
  select user_id into existing_owner from explanation_usage where request_id = p_request_id;
  if found then
    return existing_owner = p_user_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_period_start::text, 0));
  if p_limit is not null then
    select count(*) into current_count
      from explanation_usage
      where user_id = p_user_id and period_start = p_period_start;
    if current_count >= p_limit then
      return false;
    end if;
  end if;

  insert into explanation_usage(user_id, request_id, period_start)
  values (p_user_id, p_request_id, p_period_start);
  return true;
end;
$$;

alter table subscriptions enable row level security;
alter table explanation_usage enable row level security;

create policy "subscriptions own read" on subscriptions for select using (auth.uid() = user_id);
create policy "explanation usage own read" on explanation_usage for select using (auth.uid() = user_id);

-- Backend-only writes use the service role; no client insert/update/delete policies are granted.
