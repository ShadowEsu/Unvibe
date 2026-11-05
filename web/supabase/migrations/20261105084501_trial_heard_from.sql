-- Optional first-run answer to "Where did you hear about Unvibe?" (attraction report item A5).
-- One nullable column on the anonymous install record, so existing rows and older app builds stay
-- valid. The app sends it once through POST /api/v1/trial/progress (step `heard_from`), and only
-- when "Send anonymous setup progress" is on. The API trims it, collapses whitespace, drops control
-- characters, caps it at 200 characters and stores it only for an install that already has its row.
-- The first non-empty answer wins: a later send never overwrites it. The stats page never reads it.
--
-- The API may deploy before this is applied. Until then POST /api/v1/trial/progress answers 503 for
-- `heard_from`, so the app keeps the answer and retries on later launches.
--
-- The guard stops the whole transaction if a heard_from column already exists with another type,
-- since `add column if not exists` would otherwise skip it silently and leave the check unenforced.
--
-- Rollback:
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

commit;
