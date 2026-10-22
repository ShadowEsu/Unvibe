-- consume_usage is SECURITY DEFINER and is called only by the server with the service-role key.
-- Browser roles must not run it (anon could drain another user's beta allowance).
revoke execute on function public.consume_usage(uuid, text, integer) from public, anon, authenticated;

-- Rollback (restores the ACL as of 2026-10-22):
-- grant execute on function public.consume_usage(uuid, text, integer) to public, anon, authenticated;
