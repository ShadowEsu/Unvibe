-- Durable, idempotent download and email-delivery records for private beta releases.
-- Writes use the server-only service role. Public roles receive no table policy.

create table if not exists public.beta_downloads (
  id               uuid primary key default gen_random_uuid(),
  first_name       text not null,
  email            text not null,
  platform         text not null default 'mac',
  release          text not null,
  referral_code    text not null,
  created_at       timestamptz not null default now(),
  email_sent_at    timestamptz,
  email_message_id text,
  constraint beta_downloads_email_release_unique unique (email, release),
  constraint beta_downloads_platform_check check (platform = 'mac')
);

create index if not exists beta_downloads_created_at_idx
  on public.beta_downloads (created_at desc);

alter table public.beta_downloads enable row level security;

-- Deliberately no anon/authenticated policies: API routes use the server-only service role.
