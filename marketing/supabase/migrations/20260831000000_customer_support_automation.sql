-- Additive customer-support action ledger. This keeps automated replies
-- idempotent while retaining drafts for founder review without duplicating the
-- incoming message contents.
create table if not exists public.customer_support_actions (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  category text not null,
  decision text not null check (decision in ('auto_reply', 'draft', 'suppress')),
  status text not null check (status in ('queued', 'draft', 'sent', 'failed', 'suppressed')),
  reply_subject text not null,
  reply_text text not null,
  provider_message_id text unique,
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_support_actions_status_created_idx
  on public.customer_support_actions (status, created_at desc);

alter table public.customer_support_actions enable row level security;
revoke all on table public.customer_support_actions from public, anon, authenticated;
