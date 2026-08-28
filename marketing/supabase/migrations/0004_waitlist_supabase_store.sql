-- Prepares waitlist_entries to become the real waitlist store, replacing the Vercel Blob
-- implementation. That store was suspended by a Vercel Hobby-plan usage block, which made
-- the whole waitlist unreadable and unwritable — moving to the database we already run
-- avoids that failure mode entirely.
--
-- tool/experience were originally required at signup, but the live form only collects them
-- afterwards (a PATCH once the person is already on the list), so they must be nullable.
-- This table has never been populated in production, so relaxing that constraint and adding
-- not-null name columns is safe.
alter table public.waitlist_entries
  alter column tool drop not null,
  alter column experience drop not null,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists notification_status text,
  add column if not exists notification_provider text,
  add column if not exists notification_at timestamptz,
  add column if not exists notification_message_id text;
