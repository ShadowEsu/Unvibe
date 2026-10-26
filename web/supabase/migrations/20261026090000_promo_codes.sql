-- Promo codes: single-use codes that add months of complimentary Pro without Stripe
-- (spec agents/unvibe/2026-10-25-promo-codes-spec.md; first batch: Cal Hacks 13.0).
--
--   * promo_batches: one row per campaign. Months per code (1 to 12), a redeem-by time, a cap on
--     redemptions, and a revoked time that switches every code of the batch off.
--   * promo_codes: sha256("unvibe-promo:" + normalised code) in hex. The code itself is never
--     stored. Rows are created by a one-off, hash-only insert generated locally, never by the API.
--   * promo_redemptions: one row per redeemed code (the code hash is the primary key, so a code is
--     used once) and at most one per account per batch (unique batch_id, user_id). `granted` is the
--     Pro time this redemption actually added (after the 12-month ceiling), so a revoke takes back
--     exactly that. Deleting the account keeps the row (the code stays used and still counts
--     against the cap) but drops the user link and the email.
--   * redeem_promo_code: the grant goes through add_pro_months, the path gifts, the welcome month
--     and the feedback month use: 30-day months, stacked on running complimentary Pro, at most 12
--     months ahead, and never on a live Stripe subscription. When add_pro_months returns false
--     nothing is written and the code stays usable (status has_paid_plan).
--   * revoke_promo_code: switches a code off. If it was redeemed and the account has no live Stripe
--     subscription, it takes back only the promo time not used yet: add_pro_months stacks, so the
--     redemption occupies [period_end_after - granted, period_end_after], and only the part still
--     ahead of now() comes off the end date (never before now). Used-up promo time and later Pro
--     time (gift, welcome months) stay. The redemption is marked revoked, so a second revoke changes
--     nothing. months_taken_back is true only when the end date moved. A paid subscription is never
--     touched.
--
-- Locking: every redemption and revocation in a batch first takes that batch's row lock
-- (select ... for update), so the cap, one-per-account and used checks always see every committed
-- redemption of the batch. The account's subscription row is locked next, before its end date is
-- read. add_pro_months (re-declared at the end of this file) takes the same row lock before it reads
-- the end date, so a concurrent grant from another batch, a gift or the welcome month waits for this
-- one instead of writing back an end date read before it. The order is always batch row, then
-- subscription row.
--
-- RLS is on with no policies; public, anon and authenticated have no table or function rights.
-- Only the service role (the API) can call the two functions.
--
-- Rollback (deletes every batch, code and redemption record; Pro months already granted stay):
--   begin;
--   drop function if exists public.revoke_promo_code(text);
--   drop function if exists public.redeem_promo_code(uuid, text);
--   drop table if exists public.promo_redemptions;
--   drop function if exists public.promo_redemption_forget_user();
--   drop table if exists public.promo_codes;
--   drop table if exists public.promo_batches;
--   commit;
-- After a rollback, add_pro_months keeps its subscription row lock (safe: it only makes grants wait).

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
  -- Null once the account is deleted: the code stays used and keeps counting against the cap.
  user_id uuid references public.users(id) on delete set null,
  email text,
  months integer not null check (months between 1 and 12),
  -- What this redemption added to the Pro end date (after the 12-month ceiling); revoke takes back exactly this.
  granted interval not null check (granted >= interval '0'),
  period_end_before timestamptz,
  period_end_after timestamptz not null,
  redeemed_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- The redemption's batch is always its code's batch.
  foreign key (code_hash, batch_id) references public.promo_codes (code_hash, batch_id),
  unique (batch_id, user_id)
);
create index if not exists promo_redemptions_user_idx on public.promo_redemptions (user_id);

-- When the account is deleted (user_id set to null by the foreign key), its email goes too.
create or replace function public.promo_redemption_forget_user()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null then new.email := null; end if;
  return new;
end;
$$;
revoke all on function public.promo_redemption_forget_user() from public, anon, authenticated;
drop trigger if exists promo_redemptions_forget_user on public.promo_redemptions;
create trigger promo_redemptions_forget_user
  before update of user_id on public.promo_redemptions
  for each row execute function public.promo_redemption_forget_user();

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
  v_sub public.subscriptions%rowtype;
  v_before timestamptz;
  v_from timestamptz;
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
  select s.* into strict v_sub
    from public.subscriptions s where s.workspace_id = v_workspace_id for update;
  v_before := v_sub.current_period_end;
  -- Where add_pro_months starts counting (same rule, same now() in this transaction).
  v_from := case
    when v_sub.plan = 'pro' and v_sub.status = 'trialing' and v_sub.current_period_end > now() then v_sub.current_period_end
    else now()
  end;

  if not public.add_pro_months(p_user_id, v_batch.months) then
    -- A live Stripe subscription: nothing is written, the code stays usable.
    return query select 'has_paid_plan'::text, null::integer, null::timestamptz;
    return;
  end if;

  select s.current_period_end into v_after from public.subscriptions s where s.workspace_id = v_workspace_id;
  insert into public.promo_redemptions (code_hash, batch_id, user_id, email, months, granted, period_end_before, period_end_after)
    values (p_code_hash, v_batch.id, p_user_id, nullif(v_email, ''), v_batch.months,
            greatest(v_after - v_from, interval '0'), v_before, v_after);

  return query select 'redeemed'::text, v_batch.months, v_after;
end;
$$;
revoke all on function public.redeem_promo_code(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_promo_code(uuid, text) to service_role;

-- Admin revoke. One row: (status, months_taken_back, pro_until). status is revoked,
-- already_revoked or not_found. months_taken_back is true only when the Pro end date moved; it is
-- false when the code was never redeemed, its redemption was already revoked, the promo time is
-- used up, the account is gone, or the account has a live Stripe subscription (never touched).
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
  v_remaining interval;
  v_moved boolean := false;
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

  -- add_pro_months stacks, so this redemption occupies [period_end_after - granted, period_end_after].
  -- Only the part of it still ahead of now() is unused; later grants (gifts, welcome) sit after it.
  v_remaining := greatest(least(v_redemption.granted, v_redemption.period_end_after - now()), interval '0');
  v_end := v_sub.current_period_end;
  if v_remaining > interval '0' and v_sub.plan = 'pro' and v_sub.status = 'trialing' and v_sub.current_period_end > now() then
    v_end := greatest(now(), v_sub.current_period_end - v_remaining);
    v_moved := v_end <> v_sub.current_period_end;
    if v_moved then
      update public.subscriptions s
        set current_period_end = v_end, updated_at = now()
        where s.workspace_id = v_sub.workspace_id;
    end if;
  end if;
  update public.promo_redemptions r set revoked_at = now() where r.code_hash = p_code_hash;

  return query select v_status, v_moved, v_end;
end;
$$;
revoke all on function public.revoke_promo_code(text) from public, anon, authenticated;
grant execute on function public.revoke_promo_code(text) to service_role;

-- add_pro_months, re-declared with one change: it locks the subscription row before it reads the end
-- date. Every complimentary grant goes through it (gift, welcome, feedback and referral months, and
-- this promo), so grants to one account now run one at a time. Before, a gift's plain read didn't wait
-- for a redemption holding the lock: it read the old end date and, once the redemption committed,
-- wrote that date plus 30 days, so the promo's months were lost (Security R1: 68 of 500 concurrent
-- rounds on real Postgres). Everything else is line for line 20261006120000_referrals_and_app_waitlist.sql;
-- create or replace keeps its grants (none for public, anon or authenticated).
create or replace function public.add_pro_months(p_user_id uuid, p_months integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_sub subscriptions%rowtype;
  v_from timestamptz := now();
begin
  if p_months is null or p_months <= 0 then return false; end if;
  v_workspace_id := ensure_personal_workspace(p_user_id);
  select * into strict v_sub from subscriptions where workspace_id = v_workspace_id for update;
  if v_sub.stripe_subscription_id is not null and v_sub.status not in ('canceled', 'inactive') then
    return false;
  end if;
  if v_sub.plan = 'pro' and v_sub.status = 'trialing' and v_sub.current_period_end > now() then
    v_from := v_sub.current_period_end;
  end if;
  update subscriptions
    set plan = 'pro',
        interval = 'monthly',
        status = 'trialing',
        seats = 1,
        current_period_start = case when v_from > now() then coalesce(current_period_start, now()) else now() end,
        current_period_end = least(v_from + make_interval(days => 30 * p_months), now() + interval '12 months'),
        updated_at = now()
    where workspace_id = v_workspace_id;
  return true;
end;
$$;

commit;
