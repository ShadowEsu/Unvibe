-- Records idempotent beta-email delivery state for each signup. This keeps retries from
-- sending duplicate invitations while still allowing failed deliveries to be repaired.
-- Additive only; existing waitlist rows remain valid.

alter table public.waitlist_entries
  add column if not exists beta_email_status text,
  add column if not exists beta_email_at timestamptz,
  add column if not exists beta_email_message_id text,
  add column if not exists beta_email_error text;

alter table public.waitlist_entries
  drop constraint if exists waitlist_entries_beta_email_status_check;

alter table public.waitlist_entries
  add constraint waitlist_entries_beta_email_status_check
  check (beta_email_status is null or beta_email_status in ('sent', 'failed'));

create index if not exists waitlist_entries_beta_email_status_idx
  on public.waitlist_entries (beta_email_status);
