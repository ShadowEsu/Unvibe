-- First-party daily channel counts for the marketing site (unvibe.site):
--   download_cta_clicked, release_download_clicked: dim1 = surface, dim2 = platform;
--   visit_source: dim1 = first-touch utm_source, dim2 = utm_campaign, one per visitor per day.
-- Counts only: no visitor hash, ref code, IP address or user agent. The site maps every value to
-- its allow-lists ("other" for anything else) before calling; the function checks the shape again.
-- record_site_hit now returns whether the hit was the visitor's first of the day, so the site
-- counts visit_source once per visitor per day. It returned void, so it is dropped and recreated;
-- a caller that ignores the result works with either version.
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

drop function if exists public.record_site_hit(text, date);

create function public.record_site_hit(
  p_visitor_hash text,
  p_visit_date date
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_visitors integer := 0;
  inserted_days integer := 0;
begin
  if p_visitor_hash is null
    or length(p_visitor_hash) < 16
    or length(p_visitor_hash) > 64
    or p_visit_date is null then
    raise exception 'invalid traffic counter input';
  end if;

  insert into public.site_traffic_visitors (visitor_hash)
  values (p_visitor_hash)
  on conflict (visitor_hash) do nothing;
  get diagnostics inserted_visitors = row_count;

  update public.site_traffic_visitors
  set last_seen_at = now()
  where visitor_hash = p_visitor_hash;

  -- Exactly one concurrent first hit inserts the day row; the others wait for it, then count a view.
  insert into public.site_traffic_daily (visit_date, visitor_hash)
  values (p_visit_date, p_visitor_hash)
  on conflict (visit_date, visitor_hash) do nothing;
  get diagnostics inserted_days = row_count;

  if inserted_days = 0 then
    update public.site_traffic_daily
    set views = views + 1,
        last_seen_at = now()
    where visit_date = p_visit_date and visitor_hash = p_visitor_hash;
  end if;

  update public.site_traffic_totals
  set total_views = total_views + 1,
      total_visitors = total_visitors + inserted_visitors,
      updated_at = now()
  where id = 1;

  return inserted_days = 1;
end;
$$;

revoke all on function public.record_site_hit(text, date) from public, anon, authenticated, service_role;
grant execute on function public.record_site_hit(text, date) to service_role;
