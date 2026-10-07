-- Fix: RETURN QUERY does not leave a plpgsql function, so the 'pending' branch fell through
-- to the update and stamped redeemed_at on the app's first poll. Approval then failed with
-- "code not recognised". Every branch now returns explicitly.
CREATE OR REPLACE FUNCTION public.redeem_device_code(p_device_code uuid)
 RETURNS TABLE(redeemed_token uuid, redemption_status text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  device public.device_codes%rowtype;
begin
  select * into device
  from public.device_codes
  where device_code = p_device_code
  for update;

  if not found then
    return query select null::uuid, 'unknown'::text;
    return;
  elsif device.expires_at <= now() then
    return query select null::uuid, 'expired'::text;
    return;
  elsif device.redeemed_at is not null then
    return query select null::uuid, 'used'::text;
    return;
  elsif device.token is null then
    return query select null::uuid, 'pending'::text;
    return;
  end if;

  update public.device_codes
  set redeemed_at = now()
  where device_code = p_device_code;

  return query select device.token, 'approved'::text;
end;
$function$;
