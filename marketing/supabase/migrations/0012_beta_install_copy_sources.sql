-- Where install command copies came from (BOSS ledger 453 follow-up, attribution). When a visitor who
-- pressed Allow on the analytics bar copies the install command, the site sends one coarse label of
-- where they first came from (marketing/src/lib/installSource.ts: a fixed list such as search,
-- reddit, hacker_news or other, picked from the link's utm_source / utm_medium / ref; never the raw
-- values, the campaign or a referral code). This keeps one row per Pacific day and label holding only
-- a count: no visitor ID, IP address, user agent, page, referrer or timestamp column, and no per-copy
-- rows. The day comes from the server (dayKey() in src/lib/siteStatsStore.ts), never the visitor.
-- Kept 12 months: each write deletes older days.
-- Public roles have no access; the site's server routes use the service-role key.
--
-- Until this is applied the copy total in beta_install_counts still counts every copy; only the
-- per-label count is skipped (logged by error code).
--
-- Rollback:
--   drop function if exists public.record_beta_install_copy_source(date, text);
--   drop table if exists public.beta_install_copy_sources;

create table if not exists public.beta_install_copy_sources (
  day    date   not null,
  source text   not null check (source in (
    'direct', 'search', 'referral', 'reddit', 'hacker_news', 'x', 'youtube', 'tiktok', 'linkedin',
    'product_hunt', 'github', 'directory', 'email', 'app', 'other'
  )),
  copied bigint not null default 0 check (copied >= 0),
  primary key (day, source)
);

alter table public.beta_install_copy_sources enable row level security;

create or replace function public.record_beta_install_copy_source(p_day date, p_source text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_day is null or p_source is null then
    raise exception 'invalid install copy source';
  end if;

  delete from public.beta_install_copy_sources where day < (current_date - interval '12 months');

  insert into public.beta_install_copy_sources as s (day, source, copied)
  values (p_day, p_source, 1)
  on conflict (day, source) do update
    set copied = s.copied + 1;
end;
$$;

revoke all on table public.beta_install_copy_sources from public, anon, authenticated;
revoke all on function public.record_beta_install_copy_source(date, text) from public, anon, authenticated;
grant select, insert, update, delete on table public.beta_install_copy_sources to service_role;
grant execute on function public.record_beta_install_copy_source(date, text) to service_role;
