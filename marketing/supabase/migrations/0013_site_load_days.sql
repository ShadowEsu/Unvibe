-- Page loads per Pacific day by utm_source (E1 PR-C; Security file
-- boss-handoff requests/security/20261105-2342-unvibe-e1-counters-consent.md). The site's middleware adds one
-- per counted document load (src/lib/siteLoads.ts): one row per day and source holding only a count, with no
-- visitor ID, IP address, user agent, referrer, page address or timestamp column and no per-request rows,
-- like consent_answer_days (0011) and install_script_days (0012). Total page loads = the sum over sources.
-- site_load_sources is the closed allowlist (E1-2): the foreign key refuses any other source, so no caller
-- can create arbitrary rows. A new source is one insert here plus the same value in SITE_LOAD_SOURCES
-- (a test keeps this file's list and the code's equal). Public roles have no access; the middleware calls
-- the function with the service-role key.
--
-- Rollback (additive only; nothing else reads these):
--   drop function if exists public.record_site_load(date, text);
--   drop table if exists public.site_load_days;
--   drop table if exists public.site_load_sources;

create table if not exists public.site_load_sources (
  source text primary key check (source ~ '^[a-z0-9]{1,40}$')
);

insert into public.site_load_sources (source) values
  ('none'), ('other'),
  ('instagram'), ('tiktok'), ('x'), ('youtube'), ('threads'), ('linkedin'), ('github'), ('slack'),
  ('devpost'), ('outreach'), ('consoledev'), ('reddit'), ('hackernews'),
  ('peerpush'), ('sideprojectors'), ('launchingnext'), ('tinylaunch'), ('startupfame'), ('fazier'),
  ('futuretools'), ('saashub'), ('uneed'), ('startupbase'), ('devhunt'), ('whatlaunchedtoday'),
  ('aidirectorysite'), ('aier'), ('aisotools'), ('aitoolboard'), ('cloudfindr'), ('devsuite'),
  ('dodoindex'), ('findtools'), ('oksaas'), ('phyco'), ('saaspage'), ('scriptbyai'), ('superaitools'),
  ('therundown'), ('todaylaunches'), ('trylaunch'), ('visalytica')
on conflict (source) do nothing;

create table if not exists public.site_load_days (
  day    date   not null,
  source text   not null references public.site_load_sources (source),
  count  bigint not null default 0 check (count >= 0),
  primary key (day, source)
);

alter table public.site_load_sources enable row level security;
alter table public.site_load_days enable row level security;

create or replace function public.record_site_load(p_day date, p_source text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_day is null or p_source is null then
    raise exception 'invalid site load';
  end if;

  insert into public.site_load_days as d (day, source, count)
  values (p_day, p_source, 1)
  on conflict (day, source) do update
    set count = d.count + 1;
end;
$$;

revoke all on table public.site_load_sources from public, anon, authenticated;
revoke all on table public.site_load_days from public, anon, authenticated;
revoke all on function public.record_site_load(date, text) from public, anon, authenticated;
grant select on table public.site_load_sources to service_role;
grant select, insert, update on table public.site_load_days to service_role;
grant execute on function public.record_site_load(date, text) to service_role;
