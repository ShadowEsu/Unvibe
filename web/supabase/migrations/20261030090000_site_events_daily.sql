-- First-party daily channel counts for the marketing site (unvibe.site):
--   download_cta_clicked, release_download_clicked: dim1 = surface, dim2 = platform;
--   visit_source: dim1 = first-touch utm_source, dim2 = utm_campaign. The browser sends the channel
--   with its first page hit of the day only, so this is one per visitor per day.
-- Counts only: no visitor hash, ref code, IP address or user agent. The site maps every value to
-- its allow-lists ("other" for anything else) before calling; the function checks the shape again.
-- Additive only: one new table and one new function; nothing existing is changed.
create table if not exists public.site_events_daily (
  day   date not null,
  event text not null check (event in ('download_cta_clicked', 'release_download_clicked', 'visit_source')),
  dim1  text not null check (dim1 ~ '^[a-z0-9_-]{1,40}$'),
  dim2  text not null check (dim2 ~ '^[a-z0-9_-]{1,40}$'),
  count bigint not null default 1 check (count > 0),
  primary key (day, event, dim1, dim2)
);

alter table public.site_events_daily enable row level security;

-- No policies. The service role writes through record_site_event only.
revoke all on table public.site_events_daily from public, anon, authenticated, service_role;
grant select, insert, update on table public.site_events_daily to service_role;

create or replace function public.record_site_event(
  p_day date,
  p_event text,
  p_dim1 text,
  p_dim2 text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_day is null
    or p_event is null
    or p_event not in ('download_cta_clicked', 'release_download_clicked', 'visit_source')
    or p_dim1 is null or p_dim1 !~ '^[a-z0-9_-]{1,40}$'
    or p_dim2 is null or p_dim2 !~ '^[a-z0-9_-]{1,40}$' then
    raise exception 'invalid site event';
  end if;

  insert into public.site_events_daily as d (day, event, dim1, dim2)
  values (p_day, p_event, p_dim1, p_dim2)
  on conflict (day, event, dim1, dim2) do update
    set count = d.count + 1;
end;
$$;

revoke all on function public.record_site_event(date, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_site_event(date, text, text, text) to service_role;
