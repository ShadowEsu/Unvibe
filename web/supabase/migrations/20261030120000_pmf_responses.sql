-- In-app product-market-fit survey answers (Sean Ellis / Superhuman, BOSS ledger 361, backlog
-- FE-09). The desktop app sends them only when the user presses Send (POST /api/v1/feedback/pmf,
-- web/src/lib/pmfSurvey.ts). One row per answer: the 4 answers, the install's explanation count
-- and days since install, and the app version. install_key is sha256 of a PMF-only prefix plus the
-- install id, never the raw id, and differs from the trial tables' key. No names, emails or IPs.
-- The API allows one answer per install per 90 days and keeps the first.
-- Public roles have no table access; the API uses the service-role key (insert, and select for the
-- repeat check and GET /api/v1/admin/pmf-export).
--
-- Rollback:
--   drop index if exists public.pmf_responses_install_created_idx;
--   drop table if exists public.pmf_responses;

create table if not exists public.pmf_responses (
  id                 bigint generated always as identity primary key,
  install_key        text        not null check (install_key ~ '^[0-9a-f]{64}$'),
  created_at         timestamptz not null default now(),
  q1                 text        not null check (q1 in ('very', 'somewhat', 'not', 'na')),
  q2                 text        not null default '' check (char_length(q2) <= 1000),
  q3                 text        not null default '' check (char_length(q3) <= 1000),
  q4                 text        not null default '' check (char_length(q4) <= 1000),
  explanations       integer     not null check (explanations between 0 and 100000),
  days_since_install integer     not null check (days_since_install between 0 and 3650),
  app_version        text        not null check (char_length(app_version) between 1 and 40)
);

-- The 90-day repeat check reads the newest row for one install.
create index if not exists pmf_responses_install_created_idx
  on public.pmf_responses (install_key, created_at desc);

alter table public.pmf_responses enable row level security;

revoke all on table public.pmf_responses from public, anon, authenticated;
grant select, insert on table public.pmf_responses to service_role;
