-- A light-touch waitlist profile. These fields are optional so email remains the
-- only requirement for beta access; they help the team invite a representative
-- group of early testers.

alter table public.waitlist_entries
  add column if not exists name text,
  add column if not exists role text;

-- The original public form already allowed an email-only submission. Relax these
-- constraints so production storage matches the API contract rather than silently
-- falling back to local development storage.
alter table public.waitlist_entries
  alter column tool drop not null,
  alter column experience drop not null;

alter table public.waitlist_entries
  add constraint waitlist_entries_name_length check (name is null or char_length(name) <= 80),
  add constraint waitlist_entries_role_length check (role is null or char_length(role) <= 80);
