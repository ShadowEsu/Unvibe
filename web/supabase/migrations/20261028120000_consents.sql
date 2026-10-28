-- Consent records (Security consent audit U21, gate condition CC-10).
--
-- One row per thing a person agreed to, with the policy version and the time:
--   * 'terms' and 'age_18' come from /activate, written by POST /api/v1/auth/approve after it signs an
--     app in (the route refuses without both boxes ticked whether or not this table exists);
--   * 'ai_send' is for the app's agreement to send code to the named provider (provider set);
--     the app keeps its own copy and sends nothing here yet.
-- A row belongs to an account (user_id) or to an anonymous trial install (install_id), never neither.
-- revoked_at marks a withdrawn agreement; rows are kept until the account is deleted (cascade).
--
--   * Additive: a new table, its indexes and RLS. Nothing existing changes.
--   * Only the API's service role reads or writes it. RLS is on with no policies, and anon and
--     authenticated have no grants.
--   * The API writes rows only when CONSENTS_TABLE=on is set on unvibe-api. Order: backup, apply this
--     migration, set CONSENTS_TABLE=on, redeploy. With the flag off the code never touches the table.
--
-- Rollback (unset CONSENTS_TABLE and redeploy first; this drops the stored agreements):
--   drop table if exists public.consents;
--   notify pgrst, 'reload schema';

create table if not exists public.consents (
  id bigserial primary key,
  user_id uuid references public.users(id) on delete cascade,
  install_id text,
  kind text not null check (kind in ('terms', 'age_18', 'ai_send')),
  provider text,
  policy_version text not null,
  agreed_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint consents_owner check (user_id is not null or install_id is not null),
  constraint consents_install_id_len check (install_id is null or length(install_id) between 8 and 128),
  constraint consents_ai_send_provider check (kind <> 'ai_send' or provider is not null)
);
create index if not exists consents_user_idx on public.consents (user_id, kind, agreed_at desc) where user_id is not null;
create index if not exists consents_install_idx on public.consents (install_id, kind, agreed_at desc) where install_id is not null;
alter table public.consents enable row level security;

revoke all on table public.consents from anon, authenticated;
revoke all on sequence public.consents_id_seq from anon, authenticated;
grant select, insert, update on table public.consents to service_role;
grant usage on sequence public.consents_id_seq to service_role;

notify pgrst, 'reload schema';
