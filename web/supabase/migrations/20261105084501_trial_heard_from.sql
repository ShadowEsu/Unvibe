-- Optional first-run answer to "Where did you hear about Unvibe?" (attraction report item A5).
-- One nullable column on the anonymous install record, so existing rows and older app builds stay
-- valid. The app sends it once through POST /api/v1/trial/progress (step `heard_from`), only when the
-- person typed an answer and pressed Continue. Typing it is its own opt-in (Security 0046, option A),
-- so the "Send setup progress" setting does not gate it; only sealed trial builds send it. The API
-- drops control characters and email- and phone-shaped text, collapses whitespace, caps it at 200
-- characters and stores it only for an install that already has its row. The first non-empty answer
-- wins: a later send never overwrites it. The stats page never reads it.
--
-- Retention: an answer is cleared 12 months after its install started (the daily pg_cron job below).
--
-- The API may deploy before this is applied. Until then POST /api/v1/trial/progress answers 503 for
-- `heard_from`, so the app keeps the answer and retries on later launches.
--
-- The guard stops the whole transaction if a heard_from column already exists with another type,
-- since `add column if not exists` would otherwise skip it silently and leave the check unenforced.
--
-- Rollback:
--   select cron.unschedule('trial-heard-from-12-months');
--   alter table public.trial_installs drop constraint if exists trial_installs_heard_from_check;
--   alter table public.trial_installs drop column if exists heard_from;
--
-- Weekly tally (read-only):
--   select lower(heard_from) as answer, count(*) from public.trial_installs
--   where heard_from is not null and not qa group by 1 order by 2 desc;

begin;

do $$
begin
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'trial_installs' and column_name = 'heard_from'
        and data_type <> 'text') then
    raise exception 'public.trial_installs.heard_from exists and is not text';
  end if;
end
$$;

alter table public.trial_installs add column if not exists heard_from text;

alter table public.trial_installs drop constraint if exists trial_installs_heard_from_check;
alter table public.trial_installs add constraint trial_installs_heard_from_check
  check (heard_from is null or char_length(heard_from) between 1 and 200);

-- Supabase's documented form (Security 0046 SHOULD-C1): pg_cron lives in pg_catalog, and postgres gets
-- the cron schema so the job can be scheduled. anon and authenticated get nothing on cron.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Daily at 03:17 UTC: clear answers older than 12 months. Re-running the migration replaces the job.
select cron.unschedule(jobid) from cron.job where jobname = 'trial-heard-from-12-months';
select cron.schedule(
  'trial-heard-from-12-months',
  '17 3 * * *',
  $$update public.trial_installs set heard_from = null
    where heard_from is not null and started_at < now() - interval '12 months'$$
);

commit;
