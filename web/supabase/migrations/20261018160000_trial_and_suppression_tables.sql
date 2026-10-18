-- Durable storage that used to live in Vercel Blob (that store is suspended, so every write was lost).
-- Server-only: RLS is on with no policies, so only the service-role key used by the API and the
-- site can read or write. No code, prompts, emails or IPs are stored.

-- Unsubscribed email addresses, as sha256 of the lowercased, trimmed address.
create table if not exists public.email_suppression (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  unsubscribed_at timestamptz not null default now()
);
alter table public.email_suppression enable row level security;

-- Anonymous trial installs. install_key is sha256 of the app's random install ID (see trialInstallKey).
create table if not exists public.trial_installs (
  install_key text primary key check (install_key ~ '^[0-9a-f]{64}$' or install_key = '__global__'),
  started_at timestamptz not null default now()
);
alter table public.trial_installs enable row level security;

-- Trial counters per install and kind ('ai_explanation' | 'project_question'). A new name: the older
-- trial_usage table (20260721000000, monthly periods) already exists and is left untouched.
create table if not exists public.trial_counters (
  install_key text not null,
  kind text not null check (kind in ('ai_explanation', 'project_question')),
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (install_key, kind)
);
alter table public.trial_counters enable row level security;

-- Write-once activation markers: first sample explained, first own-code explanation.
create table if not exists public.trial_activation (
  install_key text not null,
  kind text not null check (kind in ('sample', 'code')),
  at timestamptz not null default now(),
  primary key (install_key, kind)
);
alter table public.trial_activation enable row level security;
create index if not exists trial_activation_at_idx on public.trial_activation (at);
create index if not exists trial_installs_started_at_idx on public.trial_installs (started_at);

-- Atomic reserve: adds one use when under the limit and returns the new count, or -1 when full.
create or replace function public.trial_reserve(p_install_key text, p_kind text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_used integer;
begin
  insert into public.trial_counters (install_key, kind, used, updated_at)
  values (p_install_key, p_kind, 0, now())
  on conflict (install_key, kind) do nothing;

  update public.trial_counters
     set used = used + 1, updated_at = now()
   where install_key = p_install_key and kind = p_kind and used < p_limit
  returning used into next_used;

  return coalesce(next_used, -1);
end;
$$;
revoke all on function public.trial_reserve(text, text, integer) from public, anon, authenticated;

-- QA installs (CI device tests) are flagged so founder stats count real people only.
alter table public.trial_installs add column if not exists qa boolean not null default false;
