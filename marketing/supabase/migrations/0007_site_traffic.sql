-- Privacy-safe traffic counters for the public founder analytics page.
-- Only a salted visitor hash and Pacific calendar day are stored. Public roles
-- have no table access; server routes use the service-role key.

create table if not exists public.site_traffic_visitors (
  visitor_hash  text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table if not exists public.site_traffic_daily (
  visit_date    date not null,
  visitor_hash  text not null references public.site_traffic_visitors(visitor_hash) on delete cascade,
  views         bigint not null default 1 check (views > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (visit_date, visitor_hash)
);

create table if not exists public.site_traffic_totals (
  id              smallint primary key default 1 check (id = 1),
  total_views     bigint not null default 0 check (total_views >= 0),
  total_visitors  bigint not null default 0 check (total_visitors >= 0),
  updated_at      timestamptz not null default now()
);

insert into public.site_traffic_totals (id, total_views, total_visitors)
values (1, 0, 0)
on conflict (id) do nothing;

create index if not exists site_traffic_daily_date_idx
  on public.site_traffic_daily (visit_date desc);

create index if not exists site_traffic_daily_visitor_idx
  on public.site_traffic_daily (visitor_hash);

alter table public.site_traffic_visitors enable row level security;
alter table public.site_traffic_daily enable row level security;
alter table public.site_traffic_totals enable row level security;

-- Atomic counter update. SECURITY INVOKER keeps the caller's privileges; only
-- the server-side service role is granted execute permission.
create or replace function public.record_site_hit(
  p_visitor_hash text,
  p_visit_date date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_visitors integer := 0;
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

  insert into public.site_traffic_daily (visit_date, visitor_hash)
  values (p_visit_date, p_visitor_hash)
  on conflict (visit_date, visitor_hash) do update
    set views = public.site_traffic_daily.views + 1,
        last_seen_at = now();

  update public.site_traffic_totals
  set total_views = total_views + 1,
      total_visitors = total_visitors + inserted_visitors,
      updated_at = now()
  where id = 1;
end;
$$;

revoke all on table public.site_traffic_visitors from public, anon, authenticated;
revoke all on table public.site_traffic_daily from public, anon, authenticated;
revoke all on table public.site_traffic_totals from public, anon, authenticated;
revoke all on function public.record_site_hit(text, date) from public, anon, authenticated;
grant execute on function public.record_site_hit(text, date) to service_role;
