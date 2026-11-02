-- Checks for public.trial_used and the welcome-month branch of public.on_app_account()
-- (migration 20261103090000_trial_used.sql): one free Pro trial per email address.
--
-- Run it on a scratch or local database that has Supabase's roles (anon, authenticated, service_role),
-- pgcrypto in schema extensions, Supabase Vault, pg_cron, and every migration in ../migrations applied.
-- Never on production: the behaviour checks create and delete accounts, and block 6 deletes the Vault
-- key inside its rolled-back transaction.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f web/supabase/tests/trial_used.sql
--
-- Plain SQL with no psql meta-commands. Each check is a DO block that raises on failure, and every
-- transaction ends in rollback, so it leaves no rows behind.

-- 1. Catalog: exactly two columns, no plaintext and no user id; service role only.
begin;
do $$
declare
  cols text;
begin
  select string_agg(column_name || ':' || data_type, ',' order by ordinal_position) into cols
  from information_schema.columns where table_schema = 'public' and table_name = 'trial_used';
  if cols is distinct from 'email_fp:bytea,first_trial_on:date' then
    raise exception 'trial_used columns are %, expected email_fp:bytea,first_trial_on:date', cols;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.trial_used'::regclass) then
    raise exception 'trial_used must have RLS on';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trial_used') then
    raise exception 'trial_used must have no policies';
  end if;
  if has_table_privilege('anon', 'public.trial_used', 'select') or has_table_privilege('authenticated', 'public.trial_used', 'select')
     or has_table_privilege('anon', 'public.trial_used', 'insert') or has_table_privilege('authenticated', 'public.trial_used', 'insert') then
    raise exception 'anon and authenticated must not read or write trial_used';
  end if;
  if has_function_privilege('anon', 'public.trial_email_fp(text)', 'execute')
     or has_function_privilege('authenticated', 'public.trial_email_fp(text)', 'execute') then
    raise exception 'anon and authenticated must not compute fingerprints';
  end if;
end $$;
rollback;

-- 2. Normalization folds case, spaces and a +tag; the fingerprint is keyed and never the address.
begin;
do $$
begin
  if public.trial_email_normalize('  Ada.Lovelace+promo@Example.COM ') <> 'ada.lovelace@example.com' then
    raise exception 'normalize: got %', public.trial_email_normalize('  Ada.Lovelace+promo@Example.COM ');
  end if;
  if public.trial_email_fp('ada@example.com') <> public.trial_email_fp('ADA+x@example.com') then
    raise exception 'a +tag alias must have the same fingerprint';
  end if;
  if public.trial_email_fp('ada@example.com') = public.trial_email_fp('ada.l@example.com') then
    raise exception 'different addresses must differ';
  end if;
  if public.trial_email_fp('ada@example.com') = extensions.digest('ada@example.com', 'sha256') then
    raise exception 'the fingerprint must be keyed (HMAC), not a plain SHA-256';
  end if;
  if octet_length(public.trial_email_fp('ada@example.com')) <> 32 then
    raise exception 'the fingerprint must be 32 bytes';
  end if;
end $$;
rollback;

-- 3. Behaviour: a fresh address gets the welcome month; delete + sign in again, or a +tag alias, starts on Free.
begin;
do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid();
  u4 uuid := gen_random_uuid();
  addr constant text := 'trial-test-' || replace(gen_random_uuid()::text, '-', '') || '@example.test';
  other constant text := 'trial-other-' || replace(gen_random_uuid()::text, '-', '') || '@example.test';
  trialing boolean;
begin
  insert into public.users (id, email) values (u1, addr);
  select exists (select 1 from public.subscriptions s join public.workspaces w on w.id = s.workspace_id
                 where w.owner_user_id = u1 and w.type = 'personal' and s.plan = 'pro' and s.status = 'trialing') into trialing;
  if not trialing then raise exception 'a fresh address must get the welcome Pro month'; end if;
  if not exists (select 1 from public.trial_used where email_fp = public.trial_email_fp(addr) and first_trial_on = current_date) then
    raise exception 'the grant must write the fingerprint with today''s date';
  end if;
  -- Account deletion, as DELETE /api/v1/account does it (billing rows, then the user row), never touches trial_used.
  perform public.delete_user_billing_data(u1);
  delete from public.users where id = u1;
  if not exists (select 1 from public.trial_used where email_fp = public.trial_email_fp(addr)) then
    raise exception 'deleting the account must keep the fingerprint';
  end if;

  insert into public.users (id, email) values (u2, upper(addr));
  select exists (select 1 from public.subscriptions s join public.workspaces w on w.id = s.workspace_id
                 where w.owner_user_id = u2 and s.plan = 'pro' and s.status = 'trialing') into trialing;
  if trialing then raise exception 'delete + sign in again with the same address must start on Free'; end if;
  if exists (select 1 from public.welcome_pro_grants where user_id = u2) then
    raise exception 'no welcome grant for a used address';
  end if;

  insert into public.users (id, email) values (u3, replace(addr, '@', '+again@'));
  select exists (select 1 from public.subscriptions s join public.workspaces w on w.id = s.workspace_id
                 where w.owner_user_id = u3 and s.plan = 'pro' and s.status = 'trialing') into trialing;
  if trialing then raise exception 'a +tag alias of a used address must start on Free'; end if;

  insert into public.users (id, email) values (u4, other);
  select exists (select 1 from public.subscriptions s join public.workspaces w on w.id = s.workspace_id
                 where w.owner_user_id = u4 and s.plan = 'pro' and s.status = 'trialing') into trialing;
  if not trialing then raise exception 'a different fresh address must still get its trial'; end if;
end $$;
rollback;

-- 4. Retention: a new account deletes fingerprints older than 12 months and keeps younger ones.
begin;
do $$
declare
  old_fp constant bytea := public.trial_email_fp('trial-old-' || gen_random_uuid() || '@example.test');
  young_fp constant bytea := public.trial_email_fp('trial-young-' || gen_random_uuid() || '@example.test');
begin
  insert into public.trial_used (email_fp, first_trial_on) values
    (old_fp, current_date - interval '12 months' - interval '1 day'),
    (young_fp, current_date - interval '11 months');
  insert into public.users (id, email) values (gen_random_uuid(), 'trial-purge-' || gen_random_uuid() || '@example.test');
  if exists (select 1 from public.trial_used where email_fp = old_fp) then
    raise exception 'a fingerprint older than 12 months must be purged';
  end if;
  if not exists (select 1 from public.trial_used where email_fp = young_fp) then
    raise exception 'a fingerprint younger than 12 months must stay';
  end if;
end $$;
rollback;

-- 5. The daily purge (Security MUST-TU1): one active job at 04:17 UTC, and its own command deletes only
--    fingerprints older than 12 months.
begin;
do $$
declare
  cmd text;
  old_fp constant bytea := public.trial_email_fp('trial-cron-old-' || gen_random_uuid() || '@example.test');
  young_fp constant bytea := public.trial_email_fp('trial-cron-young-' || gen_random_uuid() || '@example.test');
begin
  if (select count(*) from cron.job where jobname = 'unvibe-trial-used-purge' and schedule = '17 4 * * *' and active) <> 1 then
    raise exception 'expected exactly one active unvibe-trial-used-purge job at 17 4 * * *';
  end if;
  select command into cmd from cron.job where jobname = 'unvibe-trial-used-purge';
  insert into public.trial_used (email_fp, first_trial_on) values
    (old_fp, current_date - interval '12 months' - interval '1 day'),
    (young_fp, current_date - interval '11 months');
  execute cmd;
  if exists (select 1 from public.trial_used where email_fp = old_fp) then
    raise exception 'the daily job must purge a fingerprint older than 12 months';
  end if;
  if not exists (select 1 from public.trial_used where email_fp = young_fp) then
    raise exception 'the daily job must keep a fingerprint younger than 12 months';
  end if;
end $$;
rollback;

-- 6. A fault in the trial check (the key is missing) costs only the trial: the waitlist row and the
--    bonus month still land (Security SHOULD-TU4).
begin;
do $$
declare
  u uuid := gen_random_uuid();
  addr constant text := 'trial-nokey-' || replace(gen_random_uuid()::text, '-', '') || '@example.test';
  rows_before bigint;
begin
  select count(*) into rows_before from public.trial_used;
  delete from vault.secrets where name = 'trial_fp_key';
  insert into public.bonus_pro_grants (email, reason) values (addr, 'feedback');
  insert into public.users (id, email) values (u, addr);
  if exists (select 1 from public.welcome_pro_grants where user_id = u) then
    raise exception 'no key: no welcome month';
  end if;
  if (select count(*) from public.trial_used) <> rows_before then
    raise exception 'no key: no fingerprint written';
  end if;
  if not exists (select 1 from public.bonus_pro_grants where email = addr and applied_at is not null) then
    raise exception 'no key: the bonus month must still be applied';
  end if;
  if not exists (select 1 from public.waitlist_entries where email = addr) then
    raise exception 'no key: the waitlist row must still be written';
  end if;
end $$;
rollback;
