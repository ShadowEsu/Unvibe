-- Opaque sessions expire server-side; browser cookies use the same 30-day maximum.
alter table tokens add column if not exists expires_at timestamptz not null default (now() + interval '30 days');
create index if not exists tokens_expiry_idx on tokens(expires_at);
