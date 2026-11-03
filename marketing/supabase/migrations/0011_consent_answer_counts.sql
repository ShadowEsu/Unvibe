-- How many times the analytics bar was answered each day, and how (BOSS 30 Oct, option a; Security
-- C-4 in requests/unvibe/20261030-0737-security-consent-answer-count.md): consent record-keeping, not
-- tracking. One row per Pacific day and answer, holding only a count: no visitor ID, IP address, user
-- agent, referrer, page, or timestamp column, and no per-event rows. The day comes from the server
-- (dayKey() in src/lib/siteStatsStore.ts, the same day the site stats use), never from the visitor.
-- Public roles have no access; the site's server route calls the function with the service-role key.

create table if not exists public.consent_answer_days (
  day    date   not null,
  answer text   not null check (answer in ('allow', 'deny')),
  count  bigint not null default 0 check (count >= 0),
  primary key (day, answer)
);

alter table public.consent_answer_days enable row level security;

create or replace function public.record_consent_answer(p_day date, p_answer text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_day is null or p_answer is null or p_answer not in ('allow', 'deny') then
    raise exception 'invalid consent answer';
  end if;

  insert into public.consent_answer_days as d (day, answer, count)
  values (p_day, p_answer, 1)
  on conflict (day, answer) do update
    set count = d.count + 1;
end;
$$;

revoke all on table public.consent_answer_days from public, anon, authenticated;
revoke all on function public.record_consent_answer(date, text) from public, anon, authenticated;
grant select, insert, update on table public.consent_answer_days to service_role;
grant execute on function public.record_consent_answer(date, text) to service_role;
