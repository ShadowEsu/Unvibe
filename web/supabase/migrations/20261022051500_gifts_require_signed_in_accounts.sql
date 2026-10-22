-- Gifts need real, signed-in accounts on both sides (security review 2026-10-22, finding 1 and site #2).
--
-- Before: anyone could POST a giver email, any receiver email and sha256(giver)[:8] to
-- /api/v1/gifts/claim, and the waitlist trigger granted months to unverified waitlist emails.
-- Now:
--   * gift_codes: the server issues HMAC codes (secret lives only in the API env) and registers
--     each one against the giver's users row when the giver opens the app's Share page.
--   * gift_redemptions: one row per gift redeemed by a signed-in receiver. Only these rows count
--     for the caps. Legacy gift_claims rows (written without authentication) count for nothing.
--   * claim_gift: atomic, filtered checks (no full-table reads): giver and receiver are users
--     rows, no self-gift, one gift received per email, five per giver, months stack up to 12
--     ahead through add_pro_months, which never touches an active paid subscription.
--   * The waitlist trigger no longer grants anything. A waitlist row proves nothing about who
--     owns the email, so claim_referral and its trigger are dropped. referred_by is still stored
--     for attribution.
--   * on_app_account no longer turns pending gift_claims into Pro months (those rows were
--     unauthenticated). It still grants the welcome month and feedback bonus months.
--   * grant_gift_month is dropped; nothing calls it.

create table if not exists gift_codes (
  code text primary key,
  user_id uuid not null unique references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table gift_codes enable row level security;
revoke all on table gift_codes from anon, authenticated;

create table if not exists gift_redemptions (
  id uuid primary key default gen_random_uuid(),
  giver_user_id uuid references users(id) on delete set null,
  receiver_user_id uuid references users(id) on delete set null,
  giver_email text not null,
  receiver_email text not null,
  code text not null,
  giver_applied boolean not null default false,
  receiver_applied boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists gift_redemptions_receiver_once on gift_redemptions (receiver_email);
create index if not exists gift_redemptions_giver_idx on gift_redemptions (giver_email);
alter table gift_redemptions enable row level security;
revoke all on table gift_redemptions from anon, authenticated;

-- Called only by the API with the service-role key, after it has checked the session (receiver)
-- and the HMAC code (giver). Returns {status, giver_applied, receiver_applied}.
create or replace function claim_gift(p_giver_id uuid, p_receiver_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_giver text;
  v_receiver text;
  v_giver_applied boolean := false;
  v_receiver_applied boolean := false;
begin
  select lower(trim(email)) into v_receiver from users where id = p_receiver_id;
  if coalesce(v_receiver, '') = '' then return jsonb_build_object('status', 'email_required'); end if;

  select lower(trim(u.email)) into v_giver
    from users u join gift_codes c on c.user_id = u.id
    where u.id = p_giver_id and c.code = p_code;
  if coalesce(v_giver, '') = '' then return jsonb_build_object('status', 'unknown_code'); end if;
  if p_giver_id = p_receiver_id or v_giver = v_receiver then return jsonb_build_object('status', 'self_gift'); end if;

  -- Giver lock first, then receiver lock, in separate key spaces, so two claims never wait on
  -- each other in a cycle.
  perform pg_advisory_xact_lock(hashtext('unvibe-gift-giver:' || v_giver));
  perform pg_advisory_xact_lock(hashtext('unvibe-gift-receiver:' || v_receiver));

  if exists (select 1 from gift_redemptions where receiver_email = v_receiver) then
    return jsonb_build_object('status', 'already_received');
  end if;
  if (select count(*) from gift_redemptions where giver_email = v_giver) >= 5 then
    return jsonb_build_object('status', 'giver_full');
  end if;

  -- Update the two subscriptions in a fixed order (by user id) so mutual gifts cannot deadlock.
  if p_giver_id < p_receiver_id then
    v_giver_applied := add_pro_months(p_giver_id, 1);
    v_receiver_applied := add_pro_months(p_receiver_id, 1);
  else
    v_receiver_applied := add_pro_months(p_receiver_id, 1);
    v_giver_applied := add_pro_months(p_giver_id, 1);
  end if;

  insert into gift_redemptions (giver_user_id, receiver_user_id, giver_email, receiver_email, code, giver_applied, receiver_applied)
    values (p_giver_id, p_receiver_id, v_giver, v_receiver, p_code, v_giver_applied, v_receiver_applied);

  return jsonb_build_object('status', 'ok', 'giver_applied', v_giver_applied, 'receiver_applied', v_receiver_applied);
end;
$$;
revoke all on function claim_gift(uuid, uuid, text) from public, anon, authenticated;
grant execute on function claim_gift(uuid, uuid, text) to service_role;

-- The waitlist trigger stops granting. A waitlist row is not proof of owning the email.
drop trigger if exists waitlist_referral_claim on waitlist_entries;
drop function if exists on_waitlist_referral();
drop function if exists claim_referral(text, text);
drop function if exists grant_gift_month(uuid, timestamptz);

-- New accounts keep the welcome month and feedback months, but no longer collect months from
-- unauthenticated gift_claims rows.
create or replace function on_app_account()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
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
      + (select count(*) from bonus_pro_grants where email = v_email and applied_at is null)::integer;
    if v_months > 0 and add_pro_months(new.id, v_months) then
      update bonus_pro_grants set applied_at = now() where email = v_email and applied_at is null;
    end if;
  exception when others then
    raise warning 'unvibe app account hook failed: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function on_app_account() from public, anon, authenticated;

-- Rollback (re-opens finding 1; run only to undo this migration):
-- begin;
-- drop function if exists claim_gift(uuid, uuid, text);
-- drop table if exists gift_redemptions;
-- drop table if exists gift_codes;
--
-- create or replace function grant_gift_month(p_user_id uuid, p_ends_at timestamptz)
-- returns boolean
-- language plpgsql
-- security invoker
-- set search_path = public, pg_temp
-- as $fn$
-- declare
--   v_workspace_id uuid;
--   v_subscription subscriptions%rowtype;
--   v_end timestamptz;
-- begin
--   v_workspace_id := ensure_personal_workspace(p_user_id);
--   select * into strict v_subscription from subscriptions where workspace_id = v_workspace_id;
--   if v_subscription.stripe_subscription_id is not null and v_subscription.status in ('active', 'trialing') then
--     return false;
--   end if;
--   v_end := p_ends_at;
--   if v_subscription.current_period_end is not null and v_subscription.current_period_end > v_end then
--     v_end := v_subscription.current_period_end;
--   end if;
--   update subscriptions
--     set plan = 'pro', interval = 'monthly', status = 'trialing', seats = 1,
--         current_period_start = now(), current_period_end = v_end, updated_at = now()
--     where workspace_id = v_workspace_id;
--   return true;
-- end;
-- $fn$;
--
-- create or replace function claim_referral(p_code text, p_receiver_email text)
-- returns boolean
-- language plpgsql
-- security definer
-- set search_path = public, pg_temp
-- as $fn$
-- declare
--   v_code text := lower(trim(coalesce(p_code, '')));
--   v_receiver text := lower(trim(coalesce(p_receiver_email, '')));
--   v_giver text;
--   v_id uuid;
--   v_user record;
-- begin
--   if position('@' in v_code) > 0 then v_code := unvibe_referral_code(v_code); end if;
--   if v_code !~ '^[a-f0-9]{8}$' or v_receiver !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return false; end if;
--   select lower(email) into v_giver from waitlist_entries
--     where lower(referral_code) = v_code order by created_at limit 1;
--   if v_giver is null then
--     select lower(email) into v_giver from users
--       where email is not null and unvibe_referral_code(email) = v_code limit 1;
--   end if;
--   if v_giver is null or v_giver = v_receiver then return false; end if;
--   perform pg_advisory_xact_lock(hashtext('unvibe-gift:' || v_giver));
--   if exists (select 1 from gift_claims where receiver_email = v_receiver) then return false; end if;
--   if (select count(*) from gift_claims where giver_email = v_giver) >= 5 then return false; end if;
--   insert into gift_claims (giver_email, receiver_email, promo_code)
--     values (v_giver, v_receiver, v_code)
--     returning id into v_id;
--   for v_user in select id from users where lower(email) = v_giver loop
--     if add_pro_months(v_user.id, 1) then update gift_claims set giver_applied_at = now() where id = v_id; end if;
--   end loop;
--   for v_user in select id from users where lower(email) = v_receiver loop
--     if add_pro_months(v_user.id, 1) then update gift_claims set receiver_applied_at = now() where id = v_id; end if;
--   end loop;
--   return true;
-- end;
-- $fn$;
--
-- create or replace function on_waitlist_referral()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = public, pg_temp
-- as $fn$
-- begin
--   if coalesce(trim(new.referred_by), '') <> '' then
--     begin
--       perform claim_referral(new.referred_by, new.email);
--     exception when others then
--       raise warning 'unvibe referral claim failed: %', sqlerrm;
--     end;
--   end if;
--   return new;
-- end;
-- $fn$;
-- create trigger waitlist_referral_claim
--   after insert on waitlist_entries
--   for each row execute function on_waitlist_referral();
-- revoke all on function claim_referral(text, text) from public, anon, authenticated;
-- revoke all on function on_waitlist_referral() from public, anon, authenticated;
--
-- create or replace function on_app_account()
-- returns trigger language plpgsql security definer set search_path = public, pg_temp as $fn$
-- declare
--   v_email text := lower(trim(coalesce(new.email, '')));
--   v_months integer := 0;
-- begin
--   if v_email = '' then return new; end if;
--   begin
--     insert into waitlist_entries (email, referral_code, utm_source, created_at)
--       values (v_email, unvibe_referral_code(v_email), 'app', now())
--       on conflict (email) do nothing;
--     if not exists (select 1 from welcome_pro_grants where user_id = new.id) then
--       insert into welcome_pro_grants (user_id, email) values (new.id, v_email);
--       v_months := 1;
--     end if;
--     v_months := v_months
--       + (select count(*) from gift_claims where giver_email = v_email and giver_applied_at is null)::integer
--       + (select count(*) from gift_claims where receiver_email = v_email and receiver_applied_at is null)::integer
--       + (select count(*) from bonus_pro_grants where email = v_email and applied_at is null)::integer;
--     if v_months > 0 and add_pro_months(new.id, v_months) then
--       update gift_claims set giver_applied_at = now() where giver_email = v_email and giver_applied_at is null;
--       update gift_claims set receiver_applied_at = now() where receiver_email = v_email and receiver_applied_at is null;
--       update bonus_pro_grants set applied_at = now() where email = v_email and applied_at is null;
--     end if;
--   exception when others then
--     raise warning 'unvibe app account hook failed: %', sqlerrm;
--   end;
--   return new;
-- end;
-- $fn$;
-- revoke all on function on_app_account() from public, anon, authenticated;
-- commit;
