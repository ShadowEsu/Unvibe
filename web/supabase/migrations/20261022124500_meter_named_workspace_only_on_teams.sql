-- A named workspace pays for metered usage only while its effective plan is Teams. Anything else
-- (a free team workspace a Free owner created, or a Teams plan that has ended) spends the caller's
-- personal allowance, so creating free team workspaces cannot multiply the Free allowance.
-- Same rule as meteredWorkspace in web/src/billing/enforce.ts; this closes the hole for code that
-- still passes the x-uncode-workspace-id header straight through. billing_overview still raises for
-- a workspace the caller does not belong to. Body otherwise identical to the live definition.
create or replace function public.reserve_billing_usage(p_user_id uuid, p_kind text, p_workspace_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_overview jsonb;
  v_workspace_id uuid;
  v_line jsonb;
  v_limit integer;
  v_used integer;
  v_period_start date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if p_kind not in ('ai_explanation','project_question','indexed_project','dictionary_item','saved_item') then raise exception 'Unknown usage kind'; end if;
  v_overview := billing_overview(p_user_id, p_workspace_id);
  if p_workspace_id is not null and (v_overview #>> '{subscription,plan}') is distinct from 'teams' then
    v_overview := billing_overview(p_user_id, null);
  end if;
  v_workspace_id := (v_overview #>> '{workspace,id}')::uuid;
  select value into strict v_line from jsonb_array_elements(v_overview->'usage') where value->>'kind' = p_kind;
  v_limit := (v_line->>'limit')::integer;

  insert into usage_monthly(workspace_id, kind, period_start, used)
  values (v_workspace_id, p_kind, v_period_start, 1)
  on conflict (workspace_id, kind, period_start) do update
    set used = usage_monthly.used + 1, updated_at = now()
    where usage_monthly.used + 1 <= v_limit
  returning used into v_used;

  if v_used is null or v_used > v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'line', v_line);
  end if;

  insert into usage_events(workspace_id, user_id, kind, quantity) values (v_workspace_id, p_user_id, p_kind, 1);
  v_line := jsonb_set(jsonb_set(v_line, '{used}', to_jsonb(v_used)), '{remaining}', to_jsonb(greatest(0, v_limit - v_used)));
  return jsonb_build_object('allowed', true, 'line', v_line);
end;
$$;

revoke all on function public.reserve_billing_usage(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_billing_usage(uuid, text, uuid) to service_role;
