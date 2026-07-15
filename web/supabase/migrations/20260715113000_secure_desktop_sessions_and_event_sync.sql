-- Secure desktop sessions and lossless multi-device learning events.
-- Additive migration: existing sessions keep working until the next sign-in, while all new
-- device approvals receive a one-time redeemable, renewable opaque session.

alter table device_codes add column if not exists redeemed_at timestamptz;
create index if not exists device_codes_redeem_idx
  on device_codes(device_code)
  where used_at is not null and redeemed_at is null;

alter table tokens add column if not exists refresh_token uuid;
alter table tokens add column if not exists expires_at timestamptz;
alter table tokens add column if not exists refreshed_at timestamptz;
alter table tokens add column if not exists revoked_at timestamptz;

-- Existing development-era rows should not become indefinite credentials when this lands.
update tokens
set expires_at = coalesce(expires_at, created_at + interval '1 hour'),
    refresh_token = coalesce(refresh_token, gen_random_uuid())
where expires_at is null or refresh_token is null;

alter table tokens alter column refresh_token set not null;
alter table tokens alter column expires_at set not null;
alter table tokens alter column expires_at set default (now() + interval '1 hour');
create unique index if not exists tokens_refresh_token_idx on tokens(refresh_token);
create index if not exists tokens_active_access_idx on tokens(token, expires_at) where revoked_at is null;

-- Keep the full local learning event available to other signed-in devices. The id remains the
-- idempotency key; `events.id` is never recreated during a pull/push reconciliation.
alter table events add column if not exists lines integer not null default 0 check (lines >= 0);
alter table events add column if not exists language text;
alter table events add column if not exists source_app text;
alter table events add column if not exists updated_at timestamptz not null default now();

-- Tokens and device codes are backend-only; RLS remains deliberately enabled with no client
-- policies. Service-role access is confined to the server process.
alter table device_codes enable row level security;
alter table tokens enable row level security;
