-- Tracks whether a waitlist entry has already received the beta invite email, so the
-- send-beta-invites script is safe to re-run — it only emails people who have not yet
-- been invited. Additive only.

alter table public.waitlist_entries
  add column if not exists invited_at timestamptz;

create index if not exists waitlist_entries_invited_at_idx
  on public.waitlist_entries (invited_at)
  where invited_at is null;
