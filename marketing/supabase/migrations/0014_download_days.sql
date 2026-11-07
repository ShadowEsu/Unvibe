-- Download clicks per Pacific day, by file and utm_source (E1 PR-B in boss-handoff agents/unvibe-growth/EXPERIMENTS.md),
-- and more counted utm_source names for site_load_days (0013).
-- The site's download links go to /download/<file>, which adds 1 here and redirects to the GitHub release asset
-- (src/app/download/[file]/route.ts, src/lib/downloadCounter.ts). One row per day, file and source holding only a
-- count: no visitor ID, IP address, user agent, referrer, path or timestamp column and no per-request rows, like
-- site_load_days. The day comes from the server, never from the request; the source is one of site_load_sources
-- (a foreign key, so a request can't create a new value). Public roles have no access; the site's server route
-- calls the function with the service-role key.
--   asset 'mac':       /download/mac        (Apple silicon .dmg)
--   asset 'mac_intel': /download/mac-intel  (Intel .dmg)
--   asset 'windows':   /download/windows    (the Windows .exe the site offers)
--
-- Rollback (additive only; nothing else reads these):
--   drop function if exists public.record_download(date, text, text);
--   drop table if exists public.download_days;
--   delete from public.site_load_sources where source in (<the values inserted below>) -- only if no
--     site_load_days or download_days row references them.

insert into public.site_load_sources (source) values
  ('microlaunch'), ('betterlaunch'), ('danielslaunches'), ('tinystartups'), ('peerless'), ('madealist'),
  ('althunt'), ('feedmystartup'), ('taaft'), ('toolify'), ('thenai'), ('toolpilot'), ('magicbox'), ('aitooly'),
  ('alternativeto'), ('stackshare'), ('g2'), ('goodfirms'), ('softwaresuggest'), ('saasworthy'), ('comparecam'),
  ('financesonline'), ('trustpilot'), ('indiehackers'), ('hashnode'), ('gitlab'), ('f6s'), ('crunchbase'),
  ('brownbook'), ('activesearchresults'), ('vsearch'), ('viesearch'), ('linkcenter'), ('linkcentre'), ('geekwire'),
  ('sidehunt'), ('makerhunt'), ('indiehunt'), ('earlyhunt'), ('unodirectory'), ('auraplusplus'),
  ('producthunt'), ('devto'), ('betalist'), ('viberank'), ('comingup'), ('vibecoding'), ('tooliq'),
  ('thetooldirectory'), ('prolaunch'), ('navtools'), ('macupdate'), ('geeknews'), ('foundermag'), ('flowtools'),
  ('firsto'), ('everyai'), ('dofollowtools'), ('devtoolsdaily'), ('buildvoyage'), ('airespo'), ('collab'), ('badge'),
  ('unvibe'), ('email'), ('hn'), ('grok'), ('discord'), ('dvc'), ('gdg')
on conflict (source) do nothing;

create table if not exists public.download_days (
  day    date   not null,
  asset  text   not null check (asset in ('mac', 'mac_intel', 'windows')),
  source text   not null references public.site_load_sources (source),
  count  bigint not null default 0 check (count >= 0),
  primary key (day, asset, source)
);

alter table public.download_days enable row level security;

create or replace function public.record_download(p_day date, p_asset text, p_source text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_day is null or p_source is null or p_asset is null or p_asset not in ('mac', 'mac_intel', 'windows') then
    raise exception 'invalid download';
  end if;

  insert into public.download_days as d (day, asset, source, count)
  values (p_day, p_asset, p_source, 1)
  on conflict (day, asset, source) do update
    set count = d.count + 1;
end;
$$;

revoke all on table public.download_days from public, anon, authenticated;
revoke all on function public.record_download(date, text, text) from public, anon, authenticated;
grant select, insert, update on table public.download_days to service_role;
grant execute on function public.record_download(date, text, text) to service_role;
