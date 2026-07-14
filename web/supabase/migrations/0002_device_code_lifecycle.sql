-- Device codes are short-lived, one-time, and bound to the Supabase-authenticated approver.
alter table device_codes add column if not exists expires_at timestamptz not null default (now() + interval '10 minutes');
alter table device_codes add column if not exists used_at timestamptz;
create index if not exists device_codes_expiry_idx on device_codes(expires_at);
