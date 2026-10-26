-- Promo codes: single-use codes that add months of complimentary Pro without Stripe
-- (spec agents/unvibe/2026-10-25-promo-codes-spec.md; first batch: Cal Hacks 13.0).
--
--   * promo_batches: one row per campaign. Months per code (1 to 12), a redeem-by time, a cap on
--     redemptions, and a revoked time that switches every code of the batch off.
--   * promo_codes: sha256("unvibe-promo:" + normalised code) in hex. The code itself is never
--     stored. Rows are created by a one-off, hash-only insert generated locally, never by the API.
--   * promo_redemptions: one row per redeemed code (the code hash is the primary key, so a code is
--     used once) and at most one per account per batch (unique batch_id, user_id).
--   * redeem_promo_code: the grant goes through add_pro_months, the path gifts, the welcome month
--     and the feedback month use: 30-day months, stacked on running complimentary Pro, at most 12
--     months ahead, and never on a live Stripe subscription. When add_pro_months returns false
--     nothing is written and the code stays usable (status has_paid_plan).
--   * revoke_promo_code: switches a code off. If it was redeemed and the account has no live Stripe
--     subscription, the months come back off the end date and the redemption is marked revoked.
--     A paid subscription is never touched.
--
-- Locking: every redemption and revocation in a batch first takes that batch's row lock
-- (select ... for update), so the cap, one-per-account and used checks always see every committed
-- redemption of the batch. The account's subscription row is locked next, before its end date is
-- read, so a concurrent grant from another batch, a gift or the welcome month cannot interleave
-- with this one and lose months. The order is always batch row, then subscription row.
--
-- RLS is on with no policies; public, anon and authenticated have no table or function rights.
-- Only the service role (the API) can call the two functions.
--
-- Rollback (deletes every batch, code and redemption record; Pro months already granted stay):
--   begin;
--   drop function if exists public.revoke_promo_code(text);
--   drop function if exists public.redeem_promo_code(uuid, text);
--   drop table if exists public.promo_redemptions;
--   drop table if exists public.promo_codes;
--   drop table if exists public.promo_batches;
--   commit;

begin;

create table if not exists public.promo_batches (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),
  label text not null check (char_length(label) between 1 and 120),
  months integer not null check (months between 1 and 12),
  redeem_by timestamptz not null,
  max_redemptions integer not null check (max_redemptions > 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  batch_id text not null references public.promo_batches(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (code_hash, batch_id)
);
create index if not exists promo_codes_batch_idx on public.promo_codes (batch_id);

create table if not exists public.promo_redemptions (
  code_hash text primary key,
  batch_id text not null references public.promo_batches(id),
  user_id uuid not null references public.users(id) on delete cascade,
  email text,
  months integer not null check (months between 1 and 12),
  period_end_before timestamptz,
  period_end_after timestamptz not null,
  redeemed_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- The redemption's batch is always its code's batch.
  foreign key (code_hash, batch_id) references public.promo_codes (code_hash, batch_id),
  unique (batch_id, user_id)
);
create index if not exists promo_redemptions_user_idx on public.promo_redemptions (user_id);

alter table public.promo_batches enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
revoke all on table public.promo_batches from public, anon, authenticated;
revoke all on table public.promo_codes from public, anon, authenticated;
revoke all on table public.promo_redemptions from public, anon, authenticated;

-- Called only by the API with the service-role key, after it has verified the caller's Supabase
-- session and hashed the normalised code. One row: (status, months, pro_until).
create or replace function public.redeem_promo_code(p_user_id uuid, p_code_hash text)
returns table (status text, months integer, pro_until timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_code public.promo_codes%rowtype;
  v_batch public.promo_batches%rowtype;
  v_prior public.promo_redemptions%rowtype;
  v_email text;
  v_workspace_id uuid;
  v_before timestamptz;
  v_after timestamptz;
  v_live integer;
begin
  if p_user_id is null or p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid'::text, null::integer, null::timestamptz;
    return;
  end if;

  select c.* into v_code from public.promo_codes c where c.code_hash = p_code_hash;
  if not found then
    return query select 'invalid'::text, null::integer, null::timestamptz;
    return;
  end if;

  -- The batch row lock: redemptions and revocations of one batch run one at a time.
  select b.* into strict v_batch from public.promo_batches b where b.id = v_code.batch_id for update;
  -- Read the code again under the lock: a revocation may have committed while this waited.
  select c.* into strict v_code from public.promo_codes c where c.code_hash = p_code_hash;

  -- Unknown, revoked code and revoked batch all answer the same, so revocation is not detectable.
  if v_code.revoked_at is not null or v_batch.revoked_at is not null then
    return query select 'invalid'::text, null::integer, null::timestamptz;
    return;
  end if;

  select r.* into v_prior from public.promo_redemptions r where r.code_hash = p_code_hash;
  if found then
    if v_prior.user_id = p_user_id and v_prior.revoked_at is null then
      return query
        select 'already_yours'::text, v_prior.months,
          coalesce((
            select s.current_period_end
            from public.subscriptions s
            join public.workspaces w on w.id = s.workspace_id
            where w.owner_user_id = p_user_id and w.type = 'personal'
              and s.plan = 'pro' and s.status = 'trialing' and s.current_period_end > now()
          ), v_prior.period_end_after);
      return;
    end if;
    return query select 'used'::text, null::integer, null::timestamptz;
    return;
  end if;

  if now() > v_batch.redeem_by then
    return query select 'expired'::text, null::integer, null::timestamptz;
    return;
  end if;

  if exists (select 1 from public.promo_redemptions r where r.batch_id = v_batch.id and r.user_id = p_user_id) then
    return query select 'one_per_account'::text, null::integer, null::timestamptz;
    return;
  end if;

  -- Revoked redemptions gave their months back, so they do not count against the cap.
  select count(*)::integer into v_live
    from public.promo_redemptions r where r.batch_id = v_batch.id and r.revoked_at is null;
  if v_live >= v_batch.max_redemptions then
    return query select 'cap_reached'::text, null::integer, null::timestamptz;
    return;
  end if;

  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'promo redemption for an unknown user';
  end if;
  select lower(trim(u.email)) into v_email from public.users u where u.id = p_user_id;

  -- The subscription row lock, taken before the end date is read and before add_pro_months reads
  -- it again, so a concurrent grant cannot interleave and lose months.
  v_workspace_id := public.ensure_personal_workspace(p_user_id);
  select s.current_period_end into v_before
    from public.subscriptions s where s.workspace_id = v_workspace_id for update;

  if not public.add_pro_months(p_user_id, v_batch.months) then
    -- A live Stripe subscription: nothing is written, the code stays usable.
    return query select 'has_paid_plan'::text, null::integer, null::timestamptz;
    return;
  end if;

  select s.current_period_end into v_after from public.subscriptions s where s.workspace_id = v_workspace_id;
  insert into public.promo_redemptions (code_hash, batch_id, user_id, email, months, period_end_before, period_end_after)
    values (p_code_hash, v_batch.id, p_user_id, nullif(v_email, ''), v_batch.months, v_before, v_after);

  return query select 'redeemed'::text, v_batch.months, v_after;
end;
$$;
revoke all on function public.redeem_promo_code(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_promo_code(uuid, text) to service_role;

-- Admin revoke. One row: (status, months_taken_back, pro_until). status is revoked,
-- already_revoked or not_found. months_taken_back is false when the code was never redeemed,
-- its redemption was already revoked, or the account has a live Stripe subscription (never touched).
create or replace function public.revoke_promo_code(p_code_hash text)
returns table (status text, months_taken_back boolean, pro_until timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_code public.promo_codes%rowtype;
  v_redemption public.promo_redemptions%rowtype;
  v_sub public.subscriptions%rowtype;
  v_status text;
  v_end timestamptz;
begin
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    return query select 'not_found'::text, false, null::timestamptz;
    return;
  end if;
  select c.* into v_code from public.promo_codes c where c.code_hash = p_code_hash;
  if not found then
    return query select 'not_found'::text, false, null::timestamptz;
    return;
  end if;

  -- Same lock order as redeem_promo_code: batch row, then subscription row.
  perform 1 from public.promo_batches b where b.id = v_code.batch_id for update;
  select c.* into strict v_code from public.promo_codes c where c.code_hash = p_code_hash;
  v_status := case when v_code.revoked_at is null then 'revoked' else 'already_revoked' end;
  update public.promo_codes c set revoked_at = coalesce(c.revoked_at, now()) where c.code_hash = p_code_hash;

  select r.* into v_redemption from public.promo_redemptions r where r.code_hash = p_code_hash;
  if not found or v_redemption.revoked_at is not null then
    return query select v_status, false, null::timestamptz;
    return;
  end if;

  -- No row (no personal workspace) leaves every v_sub field null: nothing to take back.
  select s.* into v_sub
    from public.subscriptions s
    join public.workspaces w on w.id = s.workspace_id
    where w.owner_user_id = v_redemption.user_id and w.type = 'personal'
    for update of s;
  if v_sub.stripe_subscription_id is not null and v_sub.status not in ('canceled', 'inactive') then
    -- A live paid subscription is never changed; the redemption stays as it was.
    return query select v_status, false, null::timestamptz;
    return;
  end if;

  v_end := v_sub.current_period_end;
  if v_sub.plan = 'pro' and v_sub.status = 'trialing' and v_sub.current_period_end > now() then
    v_end := greatest(now(), v_sub.current_period_end - make_interval(days => 30 * v_redemption.months));
    update public.subscriptions s
      set current_period_end = v_end, updated_at = now()
      where s.workspace_id = v_sub.workspace_id;
  end if;
  update public.promo_redemptions r set revoked_at = now() where r.code_hash = p_code_hash;

  return query select v_status, true, v_end;
end;
$$;
revoke all on function public.revoke_promo_code(text) from public, anon, authenticated;
grant execute on function public.revoke_promo_code(text) to service_role;

commit;
