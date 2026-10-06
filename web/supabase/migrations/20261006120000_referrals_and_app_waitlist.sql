-- Referrals that actually pay out, every app account on the waitlist, and a welcome Pro month.
-- Additive only: two columns, one table, functions and triggers. Every hook swallows its own
-- errors so a signup or sign-in can never fail because of a reward.

alter table gift_claims add column if not exists giver_applied_at timestamptz;
alter table gift_claims add column if not exists receiver_applied_at timestamptz;
-- A person can be referred once, by one friend.
create unique index if not exists gift_claims_receiver_once on gift_claims (receiver_email);

create table if not exists welcome_pro_grants (
  user_id uuid primary key references users(id) on delete cascade,
  email text,
  granted_at timestamptz not null default now()
);
alter table welcome_pro_grants enable row level security;

-- Same 8 character code the site and app use: first 8 hex chars of sha256(lowercased email).
create or replace function unvibe_referral_code(p_email text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select substr(encode(sha256(convert_to(lower(trim(coalesce(p_email, ''))), 'UTF8')), 'hex'), 1, 8)
$$;

-- Adds months of complimentary Pro, stacking on any gift already running. Never touches a
-- paying Stripe subscription. Capped at 12 months ahead.
create or replace function add_pro_months(p_user_id uuid, p_months integer)
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
  select * into strict v_sub from subscriptions where workspace_id = v_workspace_id;
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

-- A friend joined with someone's link (code) or typed their email. Both get a Pro month,
-- up to five friends per person. Accounts that do not exist yet get theirs on first sign-in.
create or replace function claim_referral(p_code text, p_receiver_email text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_receiver text := lower(trim(coalesce(p_receiver_email, '')));
  v_giver text;
  v_id uuid;
  v_user record;
begin
  if position('@' in v_code) > 0 then v_code := unvibe_referral_code(v_code); end if;
  if v_code !~ '^[a-f0-9]{8}$' or v_receiver !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return false; end if;

  select lower(email) into v_giver from waitlist_entries
    where lower(referral_code) = v_code order by created_at limit 1;
  if v_giver is null then
    select lower(email) into v_giver from users
      where email is not null and unvibe_referral_code(email) = v_code limit 1;
  end if;
  if v_giver is null or v_giver = v_receiver then return false; end if;

  perform pg_advisory_xact_lock(hashtext('unvibe-gift:' || v_giver));
  if exists (select 1 from gift_claims where receiver_email = v_receiver) then return false; end if;
  if (select count(*) from gift_claims where giver_email = v_giver) >= 5 then return false; end if;

  insert into gift_claims (giver_email, receiver_email, promo_code)
    values (v_giver, v_receiver, v_code)
    returning id into v_id;

  for v_user in select id from users where lower(email) = v_giver loop
    if add_pro_months(v_user.id, 1) then update gift_claims set giver_applied_at = now() where id = v_id; end if;
  end loop;
  for v_user in select id from users where lower(email) = v_receiver loop
    if add_pro_months(v_user.id, 1) then update gift_claims set receiver_applied_at = now() where id = v_id; end if;
  end loop;
  return true;
end;
$$;

-- Any new waitlist row carrying a referral claims it, whatever path created the row.
create or replace function on_waitlist_referral()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(trim(new.referred_by), '') <> '' then
    begin
      perform claim_referral(new.referred_by, new.email);
    exception when others then
      raise warning 'unvibe referral claim failed: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists waitlist_referral_claim on waitlist_entries;
create trigger waitlist_referral_claim
  after insert on waitlist_entries
  for each row execute function on_waitlist_referral();

-- Everyone with an app account is on the waitlist, gets one welcome Pro month, and receives
-- any referral months that were waiting for their account.
create or replace function on_app_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
  v_months integer := 0;
begin
  if v_email = '' then return new; end if;
  begin
    insert into waitlist_entries (email, referral_code, utm_source, created_at)
      values (v_email, unvibe_referral_code(v_email), 'app', now())
      on conflict (email) do nothing;

    if not exists (select 1 from welcome_pro_grants where user_id = new.id) then
      insert into welcome_pro_grants (user_id, email) values (new.id, v_email);
      v_months := 1;
    end if;
    v_months := v_months
      + (select count(*) from gift_claims where giver_email = v_email and giver_applied_at is null)::integer
      + (select count(*) from gift_claims where receiver_email = v_email and receiver_applied_at is null)::integer;

    if v_months > 0 and add_pro_months(new.id, v_months) then
      update gift_claims set giver_applied_at = now() where giver_email = v_email and giver_applied_at is null;
      update gift_claims set receiver_applied_at = now() where receiver_email = v_email and receiver_applied_at is null;
    end if;
  exception when others then
    raise warning 'unvibe app account hook failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists app_account_joined on users;
create trigger app_account_joined
  after insert or update of email on users
  for each row execute function on_app_account();

revoke all on function unvibe_referral_code(text) from public, anon, authenticated;
revoke all on function add_pro_months(uuid, integer) from public, anon, authenticated;
revoke all on function claim_referral(text, text) from public, anon, authenticated;
revoke all on function on_waitlist_referral() from public, anon, authenticated;
revoke all on function on_app_account() from public, anon, authenticated;

-- Backfill: every existing account joins the waitlist and gets its welcome month.
update users set email = email where email is not null;
