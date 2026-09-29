-- Additive local-to-cloud knowledge objects. Explanation bodies stay optional;
-- desktop remains the source of truth until a Teams sync ships.

create table if not exists knowledge_objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  organization_id uuid,
  repository_id text,
  object_type text not null,
  object_id text not null,
  title text not null,
  summary text not null default '',
  body text,
  source_type text not null default 'review',
  source_refs jsonb not null default '[]'::jsonb,
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE', 'TEAM')),
  verification_status text not null default 'AI_GENERATED'
    check (verification_status in ('AI_GENERATED', 'HUMAN_CONFIRMED', 'HUMAN_CORRECTED')),
  verified_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code_version text,
  freshness_status text not null default 'CURRENT'
    check (freshness_status in ('CURRENT', 'MAY_BE_STALE', 'STALE')),
  confidence numeric not null default 0.4,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists knowledge_objects_user_updated_idx
  on knowledge_objects (user_id, updated_at desc);
create index if not exists knowledge_objects_repo_idx
  on knowledge_objects (repository_id, object_type);

alter table knowledge_objects enable row level security;

create policy "knowledge objects self read" on knowledge_objects
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists understanding_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  knowledge_id uuid references knowledge_objects(id) on delete set null,
  concept text not null,
  question text not null,
  answer text not null,
  evidence text not null,
  code_version text,
  created_at timestamptz not null default now()
);

create index if not exists understanding_checks_user_idx
  on understanding_checks (user_id, created_at desc);

alter table understanding_checks enable row level security;

create policy "understanding checks self read" on understanding_checks
  to authenticated
  using ((select auth.uid()) = user_id);
