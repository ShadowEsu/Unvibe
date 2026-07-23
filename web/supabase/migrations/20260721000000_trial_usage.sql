-- Desktop trial metering. Service-role only (no anon policies).
-- Tracks per-install and shared global (__global__) monthly AI usage for sealed trial builds.

create table if not exists trial_usage (
  install_key text not null,
  period text not null,
  kind text not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (install_key, period, kind)
);

alter table trial_usage enable row level security;
