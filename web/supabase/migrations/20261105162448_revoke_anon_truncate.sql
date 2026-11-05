-- Grant-only: anon and authenticated lose TRUNCATE, TRIGGER, REFERENCES and MAINTAIN on every table in public
-- (RLS does not cover TRUNCATE), and tables postgres creates in public from now on start without them.
-- SELECT/INSERT/UPDATE/DELETE grants and every RLS policy are unchanged. Security 1309 SHOULD.
begin;

revoke truncate, trigger, references, maintain on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;

commit;
