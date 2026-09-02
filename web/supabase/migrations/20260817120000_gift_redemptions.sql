-- Complimentary Pro months from waitlist SPECIAL CHAR gifts.
-- Service role only. No client policies, so anon/authenticated cannot read these rows.

create table if not exists gift_redemptions (
  id bigint generated always as identity primary key,
  giver_email text not null,
  giver_code text not null,
  recipient_email text not null,
  months integer not null default 1,
  created_at timestamptz not null default now(),
  unique (giver_code, recipient_email)
);
create index if not exists gift_redemptions_code_idx on gift_redemptions (giver_code);

create table if not exists pending_gift_months (
  email text primary key,
  months integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table gift_redemptions enable row level security;
alter table pending_gift_months enable row level security;
