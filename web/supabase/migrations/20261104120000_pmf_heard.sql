-- One optional question added to the in-app PMF survey (BOSS ledger 453 follow-up, attribution):
-- "Where did you first hear about Unvibe?". Stored with the same answer row in pmf_responses, kept
-- 12 months like the rest of it (submit_pmf_response deletes older rows on every submission).
--   heard:       '' when unanswered, else one fixed choice (web/src/lib/pmfSurvey.ts PMF_HEARD).
--   heard_other: '' unless heard is 'other'; then the person's short note, at most 80 characters.
-- No names, emails, IPs, code or usage counts, as before.
--
-- Order: the API passes p_heard / p_heard_other only when the question was answered, and the new
-- arguments default to '', so answers without it keep working before and after this is applied.
-- An answer that includes it gets a 503 (the app keeps the draft) until this is applied.
--
-- Rollback:
--   drop function if exists public.submit_pmf_response(text, text, text, text, text, text, text, text);
--   (then re-run the function from 20261030120000_pmf_responses.sql)
--   alter table public.pmf_responses drop column if exists heard_other, drop column if exists heard;

begin;

alter table public.pmf_responses
  add column if not exists heard text not null default ''
    check (heard in ('', 'search', 'friend', 'reddit', 'hacker_news', 'x', 'youtube_tiktok', 'directory', 'other')),
  add column if not exists heard_other text not null default ''
    check (char_length(heard_other) <= 80 and (heard = 'other' or heard_other = ''));

drop function if exists public.submit_pmf_response(text, text, text, text, text, text);

-- Same as 20261030120000 plus the two new answers. Returns 'ok' when stored or 'duplicate' with
-- nothing written. Invalid values fail the table's checks.
create or replace function public.submit_pmf_response(
  p_install_key text,
  p_q1 text,
  p_q2 text,
  p_q3 text,
  p_q4 text,
  p_app_version text,
  p_heard text default '',
  p_heard_other text default ''
)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_install_key is null or p_q1 is null or p_q2 is null or p_q3 is null or p_q4 is null
     or p_app_version is null or p_heard is null or p_heard_other is null then
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

  insert into public.pmf_responses (install_key, q1, q2, q3, q4, app_version, heard, heard_other)
  values (p_install_key, p_q1, p_q2, p_q3, p_q4, p_app_version, p_heard, p_heard_other);
  return 'ok';
end;
$$;

revoke all on function public.submit_pmf_response(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_pmf_response(text, text, text, text, text, text, text, text) to service_role;

commit;
