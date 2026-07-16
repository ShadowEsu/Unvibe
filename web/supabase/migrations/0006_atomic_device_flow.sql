-- Make device approval and one-time redemption race-safe. Both operations run inside a
-- single PostgreSQL transaction and are callable only by the server's service role.
alter table device_codes add column if not exists approved_at timestamptz;
alter table device_codes add column if not exists redeemed_at timestamptz;

update device_codes
set approved_at = used_at
where approved_at is null and used_at is not null;

create or replace function approve_device_code(
  p_user_code text,
  p_user_id uuid,
  p_email text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  device public.device_codes%rowtype;
  session_token uuid;
begin
  select * into device
  from public.device_codes
  where upper(user_code) = upper(p_user_code)
  for update;

  if not found
    or device.expires_at <= now()
    or device.redeemed_at is not null
    or (device.user_id is not null and device.user_id <> p_user_id) then
    return null;
  end if;

  insert into public.users (id, email)
  values (p_user_id, p_email)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.users.email);

  session_token := coalesce(device.token, gen_random_uuid());
  if not exists (
    select 1 from public.tokens
    where token = session_token and user_id = p_user_id
  ) then
    insert into public.tokens (token, user_id)
    values (session_token, p_user_id);
  end if;

  update public.device_codes
  set user_id = p_user_id,
      token = session_token,
      approved_at = coalesce(approved_at, now()),
      used_at = coalesce(used_at, now())
  where device_code = device.device_code;

  return session_token;
end;
$$;

create or replace function redeem_device_code(p_device_code uuid)
returns table (redeemed_token uuid, redemption_status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  device public.device_codes%rowtype;
begin
  select * into device
  from public.device_codes
  where device_code = p_device_code
  for update;

  if not found then
    return query select null::uuid, 'unknown'::text;
  elsif device.expires_at <= now() then
    return query select null::uuid, 'expired'::text;
  elsif device.redeemed_at is not null then
    return query select null::uuid, 'used'::text;
  elsif device.token is null then
    return query select null::uuid, 'pending'::text;
  end if;

  update public.device_codes
  set redeemed_at = now()
  where device_code = p_device_code;

  return query select device.token, 'approved'::text;
end;
$$;

revoke all on function approve_device_code(text, uuid, text) from public, anon, authenticated;
revoke all on function redeem_device_code(uuid) from public, anon, authenticated;
grant execute on function approve_device_code(text, uuid, text) to service_role;
grant execute on function redeem_device_code(uuid) to service_role;
