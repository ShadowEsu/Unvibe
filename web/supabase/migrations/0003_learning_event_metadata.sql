-- Add the client-captured activity metadata needed for timezone-safe streaks and full restore.
-- Existing records retain a conservative UTC-derived date and zero/unknown display metadata.
alter table events add column if not exists event_type text not null default 'explanation_completed'
  check (event_type in ('explanation_completed'));
alter table events add column if not exists local_date date;
alter table events add column if not exists timezone text;
alter table events add column if not exists lines integer not null default 0 check (lines >= 0);
alter table events add column if not exists language text;
alter table events add column if not exists source_app text;

update events set local_date = (ts at time zone 'UTC')::date where local_date is null;
update events set timezone = 'UTC' where timezone is null;

alter table events alter column local_date set not null;
alter table events alter column timezone set not null;

create index if not exists events_user_local_date_idx on events(user_id, local_date);
