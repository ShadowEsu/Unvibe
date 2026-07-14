-- Waitlist entries for the Unvibe marketing site.
-- Writes happen only through the API route using the service role key. Row-level
-- security is enabled with no permissive policies for anon/authenticated roles, so the
-- table is not readable or writable by the public anon key. The service role bypasses
-- RLS, which is exactly what the server route uses.

create table if not exists public.waitlist_entries (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  tool          text not null,
  experience    text not null,
  message       text,
  referral_code text not null,
  referred_by   text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  created_at    timestamptz not null default now(),
  constraint waitlist_entries_email_normalized unique (email)
);

create index if not exists waitlist_entries_created_at_idx
  on public.waitlist_entries (created_at desc);

create index if not exists waitlist_entries_referral_code_idx
  on public.waitlist_entries (referral_code);

alter table public.waitlist_entries enable row level security;

-- No anon/authenticated policies are created on purpose: only the service role
-- (used server-side) may read or write. This prevents client-side scraping of emails.
