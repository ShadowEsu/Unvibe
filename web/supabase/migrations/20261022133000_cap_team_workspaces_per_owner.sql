-- At most 10 team workspaces per owner, so POST /api/v1/workspaces cannot fill the table with rows
-- (Security INFO 2 on PR #52). A per-owner transaction lock makes parallel creates count one at a
-- time, so they cannot both pass the check. web/src/billing/teamWorkspaceLimit.ts holds the same
-- cap and message, and the memory store mirrors it.
-- Body otherwise identical to the live definition (pg_get_functiondef md5 98624ade30b7d412d8d5513a431451af).
-- Rollback: ~/unvibe-e2e/followup/rollback-create_team_workspace.sql restores that definition.
create or replace function public.create_team_workspace(p_user_id uuid, p_name text)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_workspace_id uuid;
begin
  if not exists (select 1 from users where id = p_user_id) then raise exception 'User not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('create_team_workspace:' || p_user_id::text, 0));
  if (select count(*) from workspaces where owner_user_id = p_user_id and type = 'team') >= 10 then
    raise exception 'Team workspace limit reached';
  end if;
  if char_length(trim(p_name)) not between 1 and 120 then raise exception 'Workspace name must be 1-120 characters'; end if;
  insert into workspaces(name, type, owner_user_id) values (trim(p_name), 'team', p_user_id) returning id into v_workspace_id;
  insert into workspace_members(workspace_id, user_id, role) values (v_workspace_id, p_user_id, 'owner');
  insert into subscriptions(workspace_id, plan, interval, status, seats) values (v_workspace_id, 'free', null, 'inactive', 2);
  return v_workspace_id;
end;
$$;

revoke all on function public.create_team_workspace(uuid, text) from public, anon, authenticated;
grant execute on function public.create_team_workspace(uuid, text) to service_role;
