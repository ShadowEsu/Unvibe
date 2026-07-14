-- Download telemetry for the public installers (metadata only, no PII).
create table if not exists public.download_events (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('mac', 'windows')),
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists download_events_platform_created_idx
  on public.download_events (platform, created_at desc);

alter table public.download_events enable row level security;
-- No public policies: only the service role (server) can insert/read.
