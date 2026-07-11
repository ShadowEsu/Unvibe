-- Uncode initial schema (Milestone 5).
-- Applied to a Supabase Postgres project. The server uses the service-role key; RLS below
-- protects direct client access so each user can only read their own rows.

create table if not exists users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now(),
  settings jsonb not null default '{}'::jsonb,
  learner_level text not null default 'intermediate'
);

create table if not exists events (
  id text primary key,                       -- client-generated event id (idempotent upsert)
  user_id uuid not null references users(id) on delete cascade,
  ts timestamptz not null,
  scope text not null,
  level text not null,
  file text,
  outcome text not null check (outcome in ('reviewed','understood','needs_review')),
  concept text,
  concept_label text,
  project text,
  created_at timestamptz not null default now()
);
create index if not exists events_user_ts_idx on events(user_id, ts);
create index if not exists events_user_concept_idx on events(user_id, concept);

-- Device-code auth (GitHub-style device flow) and opaque bearer tokens.
create table if not exists device_codes (
  device_code uuid primary key,
  user_code text not null unique,
  user_id uuid references users(id) on delete cascade,
  token uuid,
  created_at timestamptz not null default now()
);

create table if not exists tokens (
  token uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Consent log (per docs/privacy.md).
create table if not exists consent_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  repository text not null,
  action text not null check (action in ('granted','revoked','preview_shown')),
  created_at timestamptz not null default now()
);

-- Row-Level Security: users see only their own data. The server uses the service-role key,
-- which bypasses RLS; these policies protect any direct (anon/auth) client access.
alter table users enable row level security;
alter table events enable row level security;
alter table consent_log enable row level security;

create policy "users self read" on users
  for select using (auth.uid() = id);

create policy "events self read" on events
  for select using (auth.uid() = user_id);

create policy "consent self read" on consent_log
  for select using (auth.uid() = user_id);

-- device_codes and tokens are server-only (no client policies => no client access under RLS).
alter table device_codes enable row level security;
alter table tokens enable row level security;
