-- One free Pro trial per email address (Security 20261102-2249; needs Preston's yes: migration + Privacy text).
--
-- The welcome Pro month is granted by public.on_app_account() when a public.users row is created. It
-- checked welcome_pro_grants by user_id, and that row cascades away on account deletion, so "delete the
-- account, sign in again with the same email" granted a new trial every time.
--
-- Now the grant also needs the address's keyed fingerprint to be absent from public.trial_used, and it
-- writes the fingerprint in the same statement (insert ... on conflict do nothing, then grant only if
-- that insert stored a row), so two sign-ups racing on one address can't both get a trial.
--
-- public.trial_used keeps exactly two columns: an HMAC-SHA256 of the normalized address and the day of
-- the first trial. No user id, no address, no time finer than the day. Account deletion never touches
-- it. Rows older than 12 months are deleted every time an account is created (the same pattern as
-- submit_pmf_response's 12-month retention; there is no scheduler in this project).
--
-- The HMAC key is generated inside the database into Supabase Vault by this migration: no person,
-- agent, repo or env file ever holds it. An unkeyed hash of an email can be reversed by guessing
-- addresses; a keyed one can't without the key.
--
-- Normalization: trim, lowercase, and drop a +tag from the local part. Gmail dots are not folded
-- (they are significant for most providers).
--
-- Additive and idempotent. Rollback SQL is in the kit (boss-handoff agents/unvibe/trial-used-kit-2026-11-02.md).

create table if not exists public.trial_used (
  email_fp bytea primary key check (octet_length(email_fp) = 32),
  first_trial_on date not null
);

alter table public.trial_used enable row level security;
revoke all on table public.trial_used from public, anon, authenticated;
grant select, insert, delete on table public.trial_used to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'trial_fp_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'trial_fp_key',
      'Unvibe: HMAC key for public.trial_used email fingerprints. Rotating it re-opens every trial.');
  end if;
end $$;

create or replace function public.trial_email_normalize(p_email text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when position('@' in v) > 1
      then split_part(substr(v, 1, position('@' in v) - 1), '+', 1) || substr(v, position('@' in v))
    else v
  end
  from (select lower(trim(coalesce(p_email, ''))) as v) as s
$$;

create or replace function public.trial_email_fp(p_email text)
returns bytea
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'trial_fp_key';
  if v_key is null or v_key = '' then
    raise exception 'trial fingerprint key missing';
  end if;
  return extensions.hmac(convert_to(public.trial_email_normalize(p_email), 'UTF8'), convert_to(v_key, 'UTF8'), 'sha256');
end;
$$;

revoke all on function public.trial_email_normalize(text) from public, anon, authenticated;
revoke all on function public.trial_email_fp(text) from public, anon, authenticated;
grant execute on function public.trial_email_normalize(text) to service_role;
grant execute on function public.trial_email_fp(text) to service_role;

-- The live body (pg_get_functiondef, 2026-11-02) with only the welcome-month branch changed.
-- A missing key raises inside the guarded block: that sign-up gets no trial (fails closed) and a warning.
create or replace function public.on_app_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
      delete from trial_used where first_trial_on < current_date - interval '12 months';
      insert into trial_used (email_fp, first_trial_on)
      values (trial_email_fp(v_email), current_date)
      on conflict (email_fp) do nothing;
      if found then
        insert into welcome_pro_grants (user_id, email) values (new.id, v_email);
        v_months := 1;
      end if;
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
$function$;

-- Backfill: every address that has had a welcome month and still has an account. Deleted accounts left
-- nothing to fingerprint. Their day is the day of the grant, so the 12 months run from then.
insert into public.trial_used (email_fp, first_trial_on)
select public.trial_email_fp(g.email), min(g.granted_at)::date
from public.welcome_pro_grants g
where coalesce(g.email, '') <> ''
group by public.trial_email_fp(g.email)
on conflict (email_fp) do nothing;

notify pgrst, 'reload schema';
