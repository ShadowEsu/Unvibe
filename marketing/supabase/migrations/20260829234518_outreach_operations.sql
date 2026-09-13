-- Private acquisition-outreach system of record.
-- These tables are intentionally service-role only: public visitors must never
-- be able to enumerate prospects, messages, research notes, or suppression data.

create table if not exists public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  source_platform text not null check (source_platform in ('github', 'x', 'devpost', 'hacker_news', 'other')),
  source_url text not null,
  research_note text not null,
  fit_score smallint not null check (fit_score between 0 and 100),
  status text not null default 'queued' check (status in ('queued', 'approved', 'sent', 'replied', 'suppressed', 'bounced', 'complained', 'skipped')),
  unsubscribe_token_hash text not null unique,
  suppressed_at timestamptz,
  suppression_reason text check (suppression_reason in ('unsubscribe', 'reply_stop', 'bounce', 'complaint', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outreach_contacts_email_lower_unique
  on public.outreach_contacts (lower(email));

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.outreach_contacts(id) on delete cascade,
  campaign text not null default 'builder-waitlist',
  sequence smallint not null default 1 check (sequence between 1 and 2),
  subject text not null,
  body_text text not null,
  provider text not null default 'agentmail' check (provider in ('agentmail')),
  provider_message_id text unique,
  status text not null default 'draft' check (status in ('draft', 'approved', 'queued', 'sent', 'delivered', 'bounced', 'complained', 'rejected', 'replied', 'cancelled')),
  sent_at timestamptz,
  follow_up_eligible_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, campaign, sequence)
);

create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  contact_id uuid references public.outreach_contacts(id) on delete set null,
  message_id uuid references public.outreach_messages(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

-- Internal delivery receipt for the founder's own daily outreach summary.
-- It intentionally contains aggregate delivery data only, never prospect emails.
create table if not exists public.outreach_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date date not null,
  recipient text not null,
  sent_count integer not null check (sent_count >= 0),
  status text not null default 'queued' check (status in ('queued', 'sent')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (summary_date, recipient)
);

create index if not exists outreach_contacts_status_created_idx
  on public.outreach_contacts (status, created_at);
create index if not exists outreach_messages_status_created_idx
  on public.outreach_messages (status, created_at);
create index if not exists outreach_messages_follow_up_idx
  on public.outreach_messages (follow_up_eligible_at)
  where status = 'sent';

alter table public.outreach_contacts enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.outreach_events enable row level security;
alter table public.outreach_daily_summaries enable row level security;

revoke all on table public.outreach_contacts from public, anon, authenticated;
revoke all on table public.outreach_messages from public, anon, authenticated;
revoke all on table public.outreach_events from public, anon, authenticated;
revoke all on table public.outreach_daily_summaries from public, anon, authenticated;
