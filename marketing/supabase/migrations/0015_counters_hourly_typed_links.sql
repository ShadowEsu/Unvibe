-- Counters per Pacific hour, and two typed-link sources (BOSS ledger 620; Marketing's counter fix in boss-handoff
-- agents/marketing/why-no-customers-20261112.md §10 B.1 and B.3).
--
-- Why: every YouTube upload or description edit is followed by an outside link checker that loads the site three
-- times and clicks /download/windows once, all tagged utm_source=youtube, so the day totals can't tell a viewer
-- from the checker. Two changes, both totals only, same privacy shape as 0013 and 0014 (no visitor ID, IP address,
-- user agent, referrer, path or per-request row; the day and hour come from the server, never from the request):
--
--   1. site_load_hours and download_hours: the same counts as site_load_days and download_days, with the Pacific
--      hour (0 to 23). A burst two minutes after an upload can then be matched from the database alone. The day
--      tables stay as they are and keep every reader working; the hour tables are siblings, not a replacement.
--   2. Sources 'youtubetyped' and 'instagramtyped': the short links unvibe.site/yt and /ig (next.config.ts) redirect
--      to /explain?utm_source=<that>. They are said aloud in Shorts and Reels and never written in a description,
--      caption or comment, so the checker never follows them: a count here is a person who typed the address.
--      The source column's check allows only [a-z0-9], hence no underscore.
--
-- record_site_load and record_download gain a p_hour parameter and write both the day row and the hour row in one
-- call. The two-parameter versions from 0013 and 0014 stay until the site that posts p_hour is deployed, so the
-- order of "apply migration" and "deploy" doesn't matter; they can be dropped afterwards:
--   drop function if exists public.record_site_load(date, text);
--   drop function if exists public.record_download(date, text, text);
--
-- Rollback (additive only; nothing else reads the hour tables):
--   drop function if exists public.record_site_load(date, smallint, text);
--   drop function if exists public.record_download(date, smallint, text, text);
--   drop table if exists public.site_load_hours;
--   drop table if exists public.download_hours;
--   delete from public.site_load_sources where source in ('youtubetyped', 'instagramtyped') -- only if no
--     site_load_days, site_load_hours, download_days or download_hours row references them.

insert into public.site_load_sources (source) values
  ('youtubetyped'), ('instagramtyped')
on conflict (source) do nothing;

create table if not exists public.site_load_hours (
  day    date     not null,
  hour   smallint not null check (hour between 0 and 23),
  source text     not null references public.site_load_sources (source),
  count  bigint   not null default 0 check (count >= 0),
  primary key (day, hour, source)
);

create table if not exists public.download_hours (
  day    date     not null,
  hour   smallint not null check (hour between 0 and 23),
  asset  text     not null check (asset in ('mac', 'mac_intel', 'windows')),
  source text     not null references public.site_load_sources (source),
  count  bigint   not null default 0 check (count >= 0),
  primary key (day, hour, asset, source)
);

alter table public.site_load_hours enable row level security;
alter table public.download_hours enable row level security;

create or replace function public.record_site_load(p_day date, p_hour smallint, p_source text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_day is null or p_hour is null or p_source is null or p_hour < 0 or p_hour > 23 then
    raise exception 'invalid site load';
  end if;

  insert into public.site_load_days as d (day, source, count)
  values (p_day, p_source, 1)
  on conflict (day, source) do update
    set count = d.count + 1;

  insert into public.site_load_hours as h (day, hour, source, count)
  values (p_day, p_hour, p_source, 1)
  on conflict (day, hour, source) do update
    set count = h.count + 1;
end;
$$;

create or replace function public.record_download(p_day date, p_hour smallint, p_asset text, p_source text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_day is null or p_hour is null or p_source is null or p_asset is null
     or p_hour < 0 or p_hour > 23 or p_asset not in ('mac', 'mac_intel', 'windows') then
    raise exception 'invalid download';
  end if;

  insert into public.download_days as d (day, asset, source, count)
  values (p_day, p_asset, p_source, 1)
  on conflict (day, asset, source) do update
    set count = d.count + 1;

  insert into public.download_hours as h (day, hour, asset, source, count)
  values (p_day, p_hour, p_asset, p_source, 1)
  on conflict (day, hour, asset, source) do update
    set count = h.count + 1;
end;
$$;

revoke all on table public.site_load_hours from public, anon, authenticated;
revoke all on table public.download_hours from public, anon, authenticated;
revoke all on function public.record_site_load(date, smallint, text) from public, anon, authenticated;
revoke all on function public.record_download(date, smallint, text, text) from public, anon, authenticated;
grant select, insert, update on table public.site_load_hours to service_role;
grant select, insert, update on table public.download_hours to service_role;
grant execute on function public.record_site_load(date, smallint, text) to service_role;
grant execute on function public.record_download(date, smallint, text, text) to service_role;
