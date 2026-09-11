-- Teams collab v1: any member can list teammates for authorship labels;
-- workspace history page returns metadata events with author email.

create or replace function list_workspace_members(p_user_id uuid, p_workspace_id uuid)
returns table(user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from workspace_members where workspace_id = p_workspace_id and user_id = p_user_id) then
    raise exception 'Not a member of that workspace';
  end if;
  return query select wm.user_id, u.email, wm.role, wm.joined_at
  from workspace_members wm join users u on u.id = wm.user_id
  where wm.workspace_id = p_workspace_id order by (wm.role = 'owner') desc, wm.joined_at;
end;
$$;

create or replace function workspace_history_page(
  p_workspace_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id text,
  user_id uuid,
  author_email text,
  workspace_id uuid,
  ts timestamptz,
  scope text,
  level text,
  file text,
  outcome text,
  concept text,
  concept_label text,
  project text,
  local_date text,
  timezone text,
  lines integer,
  language text,
  source_app text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  select
    e.id::text,
    e.user_id,
    u.email::text as author_email,
    e.workspace_id,
    e.ts,
    e.scope::text,
    e.level::text,
    e.file::text,
    e.outcome::text,
    e.concept::text,
    e.concept_label::text,
    e.project::text,
    e.local_date::text,
    e.timezone::text,
    e.lines,
    e.language::text,
    e.source_app::text
  from events e
  left join users u on u.id = e.user_id
  where e.workspace_id = p_workspace_id
  order by e.ts desc, e.id desc
  limit safe_limit offset safe_offset;
end;
$$;

revoke all on function workspace_history_page(uuid, integer, integer) from public;
grant execute on function workspace_history_page(uuid, integer, integer) to service_role;

-- Founding pilot: invite teammates on a team workspace without requiring a paid Teams Stripe plan.
-- Seat capacity still applies (create_team_workspace starts at 2 seats).
create or replace function create_workspace_invitation(
  p_user_id uuid, p_workspace_id uuid, p_email text, p_role text, p_token_hash text, p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_row workspace_invitations%rowtype; v_overview jsonb;
begin
  if p_role not in ('admin','member') then raise exception 'Invalid invitation role'; end if;
  if not exists (select 1 from workspace_members wm join workspaces w on w.id = wm.workspace_id where wm.workspace_id = p_workspace_id and wm.user_id = p_user_id and wm.role in ('owner','admin') and w.type = 'team') then
    raise exception 'Only team owners and admins can invite members';
  end if;
  perform 1 from subscriptions where workspace_id = p_workspace_id for update;
  update workspace_invitations set status = 'expired'
    where workspace_id = p_workspace_id and email = lower(trim(p_email)) and status = 'pending' and expires_at <= now();
  v_overview := billing_overview(p_user_id, p_workspace_id);
  if (v_overview->>'occupied_seats')::integer + (v_overview->>'pending_invitations')::integer >= (v_overview #>> '{subscription,seats}')::integer then
    raise exception 'Add a seat before sending another invitation';
  end if;
  insert into workspace_invitations(workspace_id, email, role, token_hash, invited_by, expires_at)
  values (p_workspace_id, lower(trim(p_email)), p_role, p_token_hash, p_user_id, p_expires_at) returning * into v_row;
  return to_jsonb(v_row) - 'token_hash';
end;
$$;
