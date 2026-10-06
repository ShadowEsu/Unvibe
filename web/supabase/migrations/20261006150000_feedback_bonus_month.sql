-- One bonus Pro month for feedback sent from the signed welcome email link. Additive only.

create table if not exists bonus_pro_grants (
  email text not null,
  reason text not null check (reason in ('feedback')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  primary key (email, reason)
);
alter table bonus_pro_grants enable row level security;

create or replace function grant_bonus_month(p_email text, p_reason text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user record;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return false; end if;
  insert into bonus_pro_grants (email, reason) values (v_email, p_reason) on conflict do nothing;
  if not found then return false; end if;
  for v_user in select id from users where lower(email) = v_email loop
    if add_pro_months(v_user.id, 1) then update bonus_pro_grants set applied_at = now() where email = v_email and reason = p_reason; end if;
  end loop;
  return true;
end;
$$;
revoke all on function grant_bonus_month(text, text) from public, anon, authenticated;

-- New accounts also collect feedback months that were waiting for them.
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
      + (select count(*) from gift_claims where giver_email = v_email and giver_applied_at is null)::integer
      + (select count(*) from gift_claims where receiver_email = v_email and receiver_applied_at is null)::integer
      + (select count(*) from bonus_pro_grants where email = v_email and applied_at is null)::integer;
    if v_months > 0 and add_pro_months(new.id, v_months) then
      update gift_claims set giver_applied_at = now() where giver_email = v_email and giver_applied_at is null;
      update gift_claims set receiver_applied_at = now() where receiver_email = v_email and receiver_applied_at is null;
      update bonus_pro_grants set applied_at = now() where email = v_email and applied_at is null;
    end if;
  exception when others then
    raise warning 'unvibe app account hook failed: %', sqlerrm;
  end;
  return new;
end;
$$;
