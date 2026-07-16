-- Scope direct-client read policies to authenticated users and avoid per-row auth function calls.
alter policy "users self read" on users
  to authenticated
  using ((select auth.uid()) = id);

alter policy "events self read" on events
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "consent self read" on consent_log
  to authenticated
  using ((select auth.uid()) = user_id);
