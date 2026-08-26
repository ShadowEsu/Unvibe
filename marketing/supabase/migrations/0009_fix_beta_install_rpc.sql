-- RETURNS TABLE declared output names that collided with column names in UPDATE,
-- so record_beta_install_event raised "column reference copied is ambiguous"
-- and founder install counters never persisted.

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
    update public.beta_install_counts as c
    set copied = c.copied + 1, updated_at = now()
    where c.id = 1;
  elsif p_event = 'fetched' then
    update public.beta_install_counts as c
    set fetched = c.fetched + 1, updated_at = now()
    where c.id = 1;
  elsif p_event = 'installed' then
    update public.beta_install_counts as c
    set installed = c.installed + 1, updated_at = now()
    where c.id = 1;
  else
    update public.beta_install_counts as c
    set survey = c.survey + 1, updated_at = now()
    where c.id = 1;
  end if;

  return query
    select c.copied, c.fetched, c.installed, c.survey
    from public.beta_install_counts c
    where c.id = 1;
end;
$$;

revoke all on function public.record_beta_install_event(text) from public, anon, authenticated;
grant execute on function public.record_beta_install_event(text) to service_role;
