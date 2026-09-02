-- Unvibe Teams foundation. Additive Phase-0 data model per the Teams Intelligence
-- Roadmap AI Build Spec. Every table is RLS-protected and readable only by
-- authenticated members of the owning organization. Backend service_role owns
-- all writes so the "scoring transparency contract" from the roadmap holds:
-- evidence rows are the source of truth; scores are derived views that always
-- store their component values, sample size, and evidence count.
--
-- Nothing here is enabled in the product until a GitHub organization is
-- connected. Tables exist so scoring and API code can be written and tested
-- against realistic data before the real GitHub App is provisioned.

-- ---------- organizations ----------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  -- Nullable until a real GitHub App install lands. A local dev org can exist
  -- without one so scoring can be exercised end-to-end.
  github_org_id text unique,
  name text not null,
  slug text not null unique,
  plan text not null default 'teams' check (plan in ('teams', 'business', 'enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- org membership ----------
create table if not exists org_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (org_id, user_id)
);

create index if not exists org_members_user_idx on org_members(user_id);

-- ---------- repositories ----------
create table if not exists org_repositories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- Nullable so local dev repos exist before GitHub connection.
  github_repo_id text,
  name text not null,
  default_branch text not null default 'main',
  visibility text not null default 'private' check (visibility in ('public', 'private', 'internal')),
  archived boolean not null default false,
  last_indexed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists org_repos_org_idx on org_repositories(org_id);

-- ---------- pull requests (metadata only, never code) ----------
create table if not exists org_pull_requests (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references org_repositories(id) on delete cascade,
  github_pr_number integer not null,
  title text not null,
  author_login text,
  state text not null check (state in ('open', 'closed', 'merged')),
  files_changed_count integer not null default 0 check (files_changed_count >= 0),
  -- Importance is initially rule-based per Phase 5 of the roadmap.
  importance text not null default 'normal' check (importance in ('low', 'normal', 'high', 'critical')),
  opened_at timestamptz not null,
  merged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (repo_id, github_pr_number)
);

create index if not exists org_prs_repo_idx on org_pull_requests(repo_id, opened_at desc);

-- ---------- concepts (shared across the org) ----------
create table if not exists org_concepts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  normalized_name text not null,
  display_name text not null,
  category text,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, normalized_name)
);

create index if not exists org_concepts_org_idx on org_concepts(org_id);

-- ---------- evidence (source of truth for every score) ----------
-- Per the scoring transparency contract: every score derives from these rows,
-- and every "Why this score?" affordance walks back to them. `weight` reflects
-- the roadmap's rule that "viewing contributes only a small amount; explicit
-- walkthrough, Q&A, verification, or recall should contribute more." Freshness
-- decay is enforced in the scoring layer, not by mutating rows.
create table if not exists org_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- Nullable when the evidence is team-wide (e.g. a merged PR the org owns).
  user_id uuid references users(id) on delete set null,
  kind text not null check (kind in (
    'pr_viewed', 'pr_walkthrough', 'pr_verified',
    'explanation_viewed', 'explanation_saved',
    'concept_seen', 'concept_verified', 'quiz_correct', 'quiz_incorrect',
    'commit_authored', 'file_touched'
  )),
  ref_kind text not null check (ref_kind in ('repo', 'pr', 'concept', 'file', 'commit', 'system')),
  ref_id text not null,
  weight numeric(6,3) not null default 1.0 check (weight >= 0),
  source text not null default 'app' check (source in ('app', 'github', 'manual')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists org_evidence_org_kind_idx on org_evidence(org_id, kind, occurred_at desc);
create index if not exists org_evidence_org_ref_idx on org_evidence(org_id, ref_kind, ref_id);
create index if not exists org_evidence_org_user_idx on org_evidence(org_id, user_id) where user_id is not null;

-- ---------- scores cache (derived views) ----------
-- Never trusted as truth; always regenerable from org_evidence. Kept as a table
-- for read-side performance because dashboards fetch dozens of scores at once.
-- `components` is the "Why this score?" payload: named contributions with
-- weights, so the UI can render the breakdown without another query.
create table if not exists org_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  scope text not null check (scope in ('organization', 'repository', 'member', 'concept', 'system')),
  -- 'organization' scope uses org_id; other scopes use the scoped entity's id.
  scope_id text not null,
  kind text not null check (kind in (
    'understanding_coverage',
    'knowledge_freshness',
    'knowledge_concentration',
    'pr_understanding',
    'repository_coverage',
    'architecture_familiarity',
    'understanding_gap'
  )),
  value numeric(6,2) check (value is null or (value >= 0 and value <= 100)),
  components jsonb not null default '{}'::jsonb,
  sample_size integer not null default 0 check (sample_size >= 0),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  insufficient_data boolean not null default false,
  calculated_at timestamptz not null default now(),
  unique (org_id, scope, scope_id, kind)
);

create index if not exists org_scores_org_scope_idx on org_scores(org_id, scope, calculated_at desc);

-- ---------- RLS ----------
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table org_repositories enable row level security;
alter table org_pull_requests enable row level security;
alter table org_concepts enable row level security;
alter table org_evidence enable row level security;
alter table org_scores enable row level security;

-- Helper: is the caller a member of this org?
create or replace function is_org_member(p_org_id uuid)
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = (select auth.uid())
  );
$$;

revoke all on function is_org_member(uuid) from public, anon, authenticated;
grant execute on function is_org_member(uuid) to authenticated;

-- Organizations: a caller sees only orgs they belong to.
create policy "orgs member read" on organizations
  for select to authenticated
  using (public.is_org_member(id));

-- Members: a caller sees the roster of orgs they belong to.
create policy "org members member read" on org_members
  for select to authenticated
  using (public.is_org_member(org_id));

-- Repositories, PRs, concepts, evidence, scores: same rule.
create policy "org repos member read" on org_repositories
  for select to authenticated
  using (public.is_org_member(org_id));

create policy "org prs member read" on org_pull_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.org_repositories r
      where r.id = repo_id and public.is_org_member(r.org_id)
    )
  );

create policy "org concepts member read" on org_concepts
  for select to authenticated
  using (public.is_org_member(org_id));

-- Evidence: extra care — team-wide rows are visible to any org member; personal
-- rows (user_id set) are visible only to the owning user and org admins/owners.
create policy "org evidence member read" on org_evidence
  for select to authenticated
  using (
    public.is_org_member(org_id) and (
      user_id is null
      or user_id = (select auth.uid())
      or exists (
        select 1 from public.org_members m
        where m.org_id = org_evidence.org_id
          and m.user_id = (select auth.uid())
          and m.role in ('owner', 'admin')
      )
    )
  );

create policy "org scores member read" on org_scores
  for select to authenticated
  using (public.is_org_member(org_id));

-- Backend service_role owns every write; direct writes from clients are denied.
revoke all on table organizations, org_members, org_repositories, org_pull_requests,
                  org_concepts, org_evidence, org_scores
  from anon, authenticated;
grant select on table organizations, org_members, org_repositories, org_pull_requests,
                     org_concepts, org_evidence, org_scores
  to authenticated;
