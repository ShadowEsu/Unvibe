-- Beta usage metering (see src/billing/plans.ts). Additive only.
-- Tracks how many "code selections" and "AI asks" each user has consumed during the
-- private beta so the reviews endpoint can enforce a fixed allotment per user.

create table if not exists usage_counters (
  user_id uuid primary key references users(id) on delete cascade,
  selections_used integer not null default 0,
  asks_used integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table usage_counters enable row level security;
-- No anon/authenticated policies: only the service role (server-side) may read or write.

-- Atomically increments the given counter only if it is still under the limit, and
-- returns the counter value after the attempt plus whether the increment was applied.
-- Using a single UPDATE ... WHERE guards against a race between two concurrent requests
-- from the same user both slipping past the limit.
create or replace function consume_usage(p_user_id uuid, p_kind text, p_limit integer)
returns table(used integer, allowed boolean)
language plpgsql
security definer
as $$
declare
  v_used integer;
begin
  insert into usage_counters (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

  if p_kind = 'selection' then
    update usage_counters
      set selections_used = selections_used + 1, updated_at = now()
      where user_id = p_user_id and selections_used < p_limit
      returning selections_used into v_used;
  else
    update usage_counters
      set asks_used = asks_used + 1, updated_at = now()
      where user_id = p_user_id and asks_used < p_limit
      returning asks_used into v_used;
  end if;

  if v_used is not null then
    return query select v_used, true;
    return;
  end if;

  if p_kind = 'selection' then
    select selections_used into v_used from usage_counters where user_id = p_user_id;
  else
    select asks_used into v_used from usage_counters where user_id = p_user_id;
  end if;
  return query select coalesce(v_used, 0), false;
end;
$$;
