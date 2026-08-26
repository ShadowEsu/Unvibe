-- Atomic founder counters for install copy / script fetch / finished install / feedback opens.
-- Public roles have no table access; server routes use the service-role key.

create table if not exists public.beta_install_counts (
  id         smallint primary key default 1 check (id = 1),
  copied     bigint not null default 0 check (copied >= 0),
  fetched    bigint not null default 0 check (fetched >= 0),
  installed  bigint not null default 0 check (installed >= 0),
  survey     bigint not null default 0 check (survey >= 0),
  updated_at timestamptz not null default now()
);

insert into public.beta_install_counts (id, copied, fetched, installed, survey)
values (1, 0, 0, 0, 0)
on conflict (id) do nothing;

alter table public.beta_install_counts enable row level security;

create or replace function public.record_beta_install_event(p_event text)
returns table (
  copied bigint,
  fetched bigint,
  installed bigint,
  survey bigint
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_event is null or p_event not in ('copied', 'fetched', 'installed', 'survey') then
    raise exception 'invalid beta install event';
  end if;

  insert into public.beta_install_counts (id)
  values (1)
  on conflict (id) do nothing;

  if p_event = 'copied' then
    update public.beta_install_counts
    set copied = copied + 1, updated_at = now()
    where id = 1;
  elsif p_event = 'fetched' then
    update public.beta_install_counts
    set fetched = fetched + 1, updated_at = now()
    where id = 1;
  elsif p_event = 'installed' then
    update public.beta_install_counts
    set installed = installed + 1, updated_at = now()
    where id = 1;
  else
    update public.beta_install_counts
    set survey = survey + 1, updated_at = now()
    where id = 1;
  end if;

  return query
    select c.copied, c.fetched, c.installed, c.survey
    from public.beta_install_counts c
    where c.id = 1;
end;
$$;

revoke all on table public.beta_install_counts from public, anon, authenticated;
revoke all on function public.record_beta_install_event(text) from public, anon, authenticated;
grant execute on function public.record_beta_install_event(text) to service_role;
