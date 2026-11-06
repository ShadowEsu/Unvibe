-- Install script requests per Pacific day (E1 in boss-handoff agents/unvibe-growth/EXPERIMENTS.md).
-- beta_install_counts (0008) keeps all-time totals only, so "how many curl / PowerShell installs ran
-- yesterday" can't be answered. This keeps the same events per day: one row per day and event holding
-- only a count, with no visitor ID, IP address, user agent, referrer or timestamp column and no
-- per-request rows, like consent_answer_days (0011). The day comes from the server (dayKey() in
-- src/lib/siteStatsStore.ts), never from the request. Public roles have no access; the site's server
-- routes call the function with the service-role key.
--   mac_fetched:  GET /install.sh (served by /api/install)
--   win_fetched:  GET /install.ps1 (served by /api/install-windows)
--   installed:    an install script's 'installed' post to /api/install/event (Mac and Windows send the same body)
--
-- Rollback (additive only; nothing else reads these):
--   drop function if exists public.record_install_script_day(date, text);
--   drop table if exists public.install_script_days;

create table if not exists public.install_script_days (
  day   date   not null,
  event text   not null check (event in ('mac_fetched', 'win_fetched', 'installed')),
  count bigint not null default 0 check (count >= 0),
  primary key (day, event)
);

alter table public.install_script_days enable row level security;

create or replace function public.record_install_script_day(p_day date, p_event text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_day is null or p_event is null or p_event not in ('mac_fetched', 'win_fetched', 'installed') then
    raise exception 'invalid install script event';
  end if;

  insert into public.install_script_days as d (day, event, count)
  values (p_day, p_event, 1)
  on conflict (day, event) do update
    set count = d.count + 1;
end;
$$;

revoke all on table public.install_script_days from public, anon, authenticated;
revoke all on function public.record_install_script_day(date, text) from public, anon, authenticated;
grant select, insert, update on table public.install_script_days to service_role;
grant execute on function public.record_install_script_day(date, text) to service_role;
