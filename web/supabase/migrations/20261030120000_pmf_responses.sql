-- In-app product-market-fit survey answers (Sean Ellis / Superhuman, BOSS ledger 361, backlog
-- FE-09; Security requirements 2026-10-30). The desktop app sends them only when the person presses
-- Send (POST /api/v1/feedback/pmf, web/src/lib/pmfSurvey.ts): the Q1 enum, 3 short texts and the app
-- version. install_key is an HMAC-SHA256 of the app's random install ID under a server secret
-- (TRY_IP_SALT, else the service-role key, as try_requests hashes IPs), never the raw ID.
-- No names, emails, IPs, code or usage counts.
-- One answer per install per 90 days, enforced by submit_pmf_response under a per-install advisory
-- lock. Kept 12 months: each submission deletes answers older than that.
-- Public roles have no table or function access; the API uses the service-role key (the function,
-- and select for GET /api/v1/admin/pmf-export).
--
-- Rollback:
--   drop function if exists public.submit_pmf_response(text, text, text, text, text, text);
--   drop table if exists public.pmf_responses;

create table if not exists public.pmf_responses (
  id           bigserial   primary key,
  install_key  text        not null check (install_key ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  q1           text        not null check (q1 in ('very', 'somewhat', 'not', 'na')),
  q2           text        not null default '' check (char_length(q2) <= 2000),
  q3           text        not null default '' check (char_length(q3) <= 2000),
  q4           text        not null default '' check (char_length(q4) <= 2000),
  app_version  text        not null check (app_version ~ '^[0-9A-Za-z.+-]{1,40}$')
);

-- The 90-day check reads one install's newest rows; the retention delete and the export read by time.
create index if not exists pmf_responses_install_created_idx
  on public.pmf_responses (install_key, created_at desc);
create index if not exists pmf_responses_created_idx
  on public.pmf_responses (created_at);

alter table public.pmf_responses enable row level security;

-- Stores one answer unless this install answered in the last 90 days. Returns 'ok' when stored or
-- 'duplicate' with nothing written (the first answer is kept). Submissions for one install run one
-- at a time under an advisory lock, so two concurrent sends can't both pass the check. Also deletes
-- every answer older than 12 months (the retention period). Invalid values fail the table's checks.
create or replace function public.submit_pmf_response(
  p_install_key text,
  p_q1 text,
  p_q2 text,
  p_q3 text,
  p_q4 text,
  p_app_version text
)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_install_key is null or p_q1 is null or p_q2 is null or p_q3 is null or p_q4 is null or p_app_version is null then
    raise exception 'invalid pmf response arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('pmf_response:' || p_install_key));

  delete from public.pmf_responses where created_at < now() - interval '12 months';

  if exists (
    select 1 from public.pmf_responses
     where install_key = p_install_key and created_at >= now() - interval '90 days'
  ) then
    return 'duplicate';
  end if;

  insert into public.pmf_responses (install_key, q1, q2, q3, q4, app_version)
  values (p_install_key, p_q1, p_q2, p_q3, p_q4, p_app_version);
  return 'ok';
end;
$$;

revoke all on table public.pmf_responses from public, anon, authenticated;
revoke all on sequence public.pmf_responses_id_seq from public, anon, authenticated;
revoke all on function public.submit_pmf_response(text, text, text, text, text, text) from public, anon, authenticated;
-- The function is security invoker, so the service role needs the table rights it uses.
grant select, insert, delete on table public.pmf_responses to service_role;
grant usage on sequence public.pmf_responses_id_seq to service_role;
grant execute on function public.submit_pmf_response(text, text, text, text, text, text) to service_role;
