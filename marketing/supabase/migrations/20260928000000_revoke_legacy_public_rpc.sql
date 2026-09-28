-- Legacy public RPCs predate the server-only marketing data model. The live
-- site does not call them; leaving them executable would expose privileged
-- SECURITY DEFINER entry points through PostgREST.
--
-- Keep the functions for historical compatibility with server maintenance,
-- but restrict execution to the service role. No user records are modified.

revoke all on function public.get_live_visitor_count() from public, anon, authenticated;
revoke all on function public.get_portfolio_visitor_stats() from public, anon, authenticated;
revoke all on function public.get_visitor_stats() from public, anon, authenticated;
revoke all on function public.get_waitlist_stats() from public, anon, authenticated;
revoke all on function public.join_waitlist(text, text) from public, anon, authenticated;
revoke all on function public.join_waitlist(text, text, text) from public, anon, authenticated;
revoke all on function public.list_waitlist_entries(text) from public, anon, authenticated;
revoke all on function public.register_portfolio_visitor(uuid, text) from public, anon, authenticated;
revoke all on function public.register_visitor(uuid, text) from public, anon, authenticated;
revoke all on function public.waitlist_public_count() from public, anon, authenticated;

grant execute on function public.get_live_visitor_count() to service_role;
grant execute on function public.get_portfolio_visitor_stats() to service_role;
grant execute on function public.get_visitor_stats() to service_role;
grant execute on function public.get_waitlist_stats() to service_role;
grant execute on function public.join_waitlist(text, text) to service_role;
grant execute on function public.join_waitlist(text, text, text) to service_role;
grant execute on function public.list_waitlist_entries(text) to service_role;
grant execute on function public.register_portfolio_visitor(uuid, text) to service_role;
grant execute on function public.register_visitor(uuid, text) to service_role;
grant execute on function public.waitlist_public_count() to service_role;
