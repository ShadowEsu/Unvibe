-- Additive billing/workspace foundation. Existing users remain on Free and keep all data.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  type text not null check (type in ('personal', 'team')),
  owner_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists workspaces_one_personal_per_owner_idx
  on workspaces(owner_user_id) where type = 'personal';
create index if not exists workspaces_owner_idx on workspaces(owner_user_id);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on workspace_members(user_id, workspace_id);

create or replace function validate_workspace_membership()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_workspace workspaces%rowtype;
begin
  if tg_op = 'DELETE' then
    select * into v_workspace from workspaces where id = old.workspace_id;
    if found and old.user_id = v_workspace.owner_user_id then raise exception 'Workspace ownership must remain an active membership'; end if;
    return old;
  end if;
  select * into strict v_workspace from workspaces where id = new.workspace_id;
  if v_workspace.type = 'personal' and (new.user_id <> v_workspace.owner_user_id or new.role <> 'owner') then
    raise exception 'Personal workspaces support only their owner';
  end if;
  if new.user_id = v_workspace.owner_user_id and new.role <> 'owner' then raise exception 'Workspace owner must have the owner role'; end if;
  if new.role = 'owner' and new.user_id <> v_workspace.owner_user_id then raise exception 'Only the workspace owner can hold the owner role'; end if;
  return new;
end;
$$;
drop trigger if exists workspace_members_validate on workspace_members;
create trigger workspace_members_validate before insert or update or delete on workspace_members
for each row execute function validate_workspace_membership();

create table if not exists plan_entitlements (
  plan text primary key check (plan in ('free', 'pro', 'teams')),
  ai_explanations integer not null check (ai_explanations > 0),
  active_projects integer not null check (active_projects > 0),
  dictionary_items integer not null check (dictionary_items > 0),
  saved_items integer not null check (saved_items > 0),
  project_questions integer not null check (project_questions > 0),
  updated_at timestamptz not null default now()
);
insert into plan_entitlements(plan, ai_explanations, active_projects, dictionary_items, saved_items, project_questions)
values
  ('free', 30, 1, 25, 20, 10),
  ('pro', 1000, 10, 1000, 1000, 500),
  ('teams', 1000, 10, 1000, 1000, 500)
on conflict (plan) do nothing;

create table if not exists subscriptions (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'teams')),
  interval text check (interval is null or interval in ('monthly', 'annual')),
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'grace_period', 'canceled', 'unpaid')),
  seats integer not null default 1 check (seats between 1 and 500),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan = 'free' and interval is null) or (plan <> 'free' and interval is not null)),
  check (plan <> 'teams' or seats >= 2)
);
create unique index if not exists subscriptions_stripe_customer_idx on subscriptions(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists subscriptions_stripe_subscription_idx on subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;

create or replace function validate_subscription_workspace()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_type text;
begin
  select type into strict v_type from workspaces where id = new.workspace_id;
  if new.plan = 'pro' and v_type <> 'personal' then raise exception 'Pro requires a personal workspace'; end if;
  if new.plan = 'teams' and v_type <> 'team' then raise exception 'Teams requires a team workspace'; end if;
  if new.plan = 'pro' and new.seats <> 1 then raise exception 'Pro must have exactly one seat'; end if;
  if new.plan = 'teams' and new.seats < 2 then raise exception 'Teams requires at least two seats'; end if;
  if new.plan = 'teams' and new.seats < greatest(2,
    (select count(*) from workspace_members where workspace_id = new.workspace_id) +
    (select count(*) from workspace_invitations where workspace_id = new.workspace_id and status = 'pending' and expires_at > now())
  ) then raise exception 'Teams seats cannot be lower than occupied and pending seats'; end if;
  return new;
end;
$$;
drop trigger if exists subscriptions_validate_workspace on subscriptions;
create trigger subscriptions_validate_workspace before insert or update on subscriptions
for each row execute function validate_subscription_workspace();

create table if not exists workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320),
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists workspace_invitations_workspace_status_idx on workspace_invitations(workspace_id, status, expires_at);
create unique index if not exists workspace_invitations_one_pending_email_idx on workspace_invitations(workspace_id, email) where status = 'pending';

create table if not exists checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  plan text not null check (plan in ('pro', 'teams')),
  interval text not null check (interval in ('monthly', 'annual')),
  seats integer not null check (seats between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired')),
  stripe_checkout_session_id text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists checkout_intents_user_created_idx on checkout_intents(user_id, created_at desc);
create index if not exists checkout_intents_workspace_idx on checkout_intents(workspace_id);
create unique index if not exists checkout_intents_one_pending_workspace_idx on checkout_intents(workspace_id) where status = 'pending';

create table if not exists billing_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists usage_monthly (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('ai_explanation', 'project_question', 'indexed_project', 'dictionary_item', 'saved_item')),
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, kind, period_start)
);

create table if not exists usage_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('ai_explanation', 'project_question', 'indexed_project', 'dictionary_item', 'saved_item')),
  quantity integer not null default 1 check (quantity > 0),
  estimated_input_tokens integer check (estimated_input_tokens is null or estimated_input_tokens >= 0),
  estimated_output_tokens integer check (estimated_output_tokens is null or estimated_output_tokens >= 0),
  created_at timestamptz not null default now()
);
create index if not exists usage_events_workspace_created_idx on usage_events(workspace_id, created_at desc);
create index if not exists usage_events_user_created_idx on usage_events(user_id, created_at desc);

create table if not exists billing_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references users(id) on delete set null,
  workspace_id uuid references workspaces(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists billing_audit_workspace_created_idx on billing_audit_log(workspace_id, created_at desc);

-- Learning records become workspace-aware without destructively rewriting their identifiers.
alter table events add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table skills add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table consent_log add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
create index if not exists events_workspace_ts_idx on events(workspace_id, ts desc);
create index if not exists skills_workspace_last_idx on skills(workspace_id, last_encountered_at desc);
create index if not exists consent_workspace_created_idx on consent_log(workspace_id, created_at desc);

create or replace function ensure_personal_workspace(p_user_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
begin
  if not exists (select 1 from users where id = p_user_id) then
    raise exception 'User not found';
  end if;

  insert into workspaces(name, type, owner_user_id)
  values ('Personal', 'personal', p_user_id)
  on conflict (owner_user_id) where type = 'personal' do nothing;

  select id into strict v_workspace_id from workspaces where owner_user_id = p_user_id and type = 'personal';
  insert into workspace_members(workspace_id, user_id, role) values (v_workspace_id, p_user_id, 'owner') on conflict do nothing;
  insert into subscriptions(workspace_id, plan, interval, status, seats)
  values (v_workspace_id, 'free', null, 'inactive', 1) on conflict (workspace_id) do nothing;
  return v_workspace_id;
end;
$$;

-- Preserve every existing account and attach its existing learning data to its free workspace.
do $$
declare
  v_user record;
  v_workspace_id uuid;
begin
  for v_user in select id from users loop
    v_workspace_id := ensure_personal_workspace(v_user.id);
    update events set workspace_id = v_workspace_id where user_id = v_user.id and workspace_id is null;
    update skills set workspace_id = v_workspace_id where user_id = v_user.id and workspace_id is null;
    update consent_log set workspace_id = v_workspace_id where user_id = v_user.id and workspace_id is null;
  end loop;
end;
$$;

create or replace function list_user_workspaces(p_user_id uuid)
returns table(id uuid, name text, type text, role text, owner_user_id uuid)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select w.id, w.name, w.type, wm.role, w.owner_user_id
  from workspace_members wm join workspaces w on w.id = wm.workspace_id
  where wm.user_id = p_user_id
  order by (w.type = 'personal') desc, w.created_at;
$$;

create or replace function get_workspace_access(p_user_id uuid, p_workspace_id uuid)
returns table(id uuid, name text, type text, role text, owner_user_id uuid)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select w.id, w.name, w.type, wm.role, w.owner_user_id
  from workspace_members wm join workspaces w on w.id = wm.workspace_id
  where wm.user_id = p_user_id and wm.workspace_id = p_workspace_id;
$$;

create or replace function create_team_workspace(p_user_id uuid, p_name text)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_workspace_id uuid;
begin
  if not exists (select 1 from users where id = p_user_id) then raise exception 'User not found'; end if;
  if char_length(trim(p_name)) not between 1 and 120 then raise exception 'Workspace name must be 1-120 characters'; end if;
  insert into workspaces(name, type, owner_user_id) values (trim(p_name), 'team', p_user_id) returning id into v_workspace_id;
  insert into workspace_members(workspace_id, user_id, role) values (v_workspace_id, p_user_id, 'owner');
  insert into subscriptions(workspace_id, plan, interval, status, seats) values (v_workspace_id, 'free', null, 'inactive', 2);
  return v_workspace_id;
end;
$$;

create or replace function billing_limit(p_plan text, p_kind text, p_seats integer)
returns integer
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare v_config plan_entitlements%rowtype; v_limit integer;
begin
  select * into strict v_config from plan_entitlements where plan = p_plan;
  v_limit := case p_kind
    when 'ai_explanation' then v_config.ai_explanations
    when 'project_question' then v_config.project_questions
    when 'indexed_project' then v_config.active_projects
    when 'dictionary_item' then v_config.dictionary_items
    when 'saved_item' then v_config.saved_items
    else 0 end;
  if p_plan = 'teams' and p_kind in ('ai_explanation','project_question') then v_limit := v_limit * p_seats; end if;
  return v_limit;
end;
$$;

create or replace function billing_overview(p_user_id uuid, p_workspace_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace record;
  v_subscription subscriptions%rowtype;
  v_plan text;
  v_occupied integer;
  v_pending integer;
  v_usage jsonb;
  v_period_start date := date_trunc('month', now() at time zone 'utc')::date;
  v_resets_at timestamptz := (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';
begin
  if p_workspace_id is null then p_workspace_id := ensure_personal_workspace(p_user_id); end if;
  select w.id, w.name, w.type, w.owner_user_id, wm.role into strict v_workspace
  from workspaces w join workspace_members wm on wm.workspace_id = w.id
  where w.id = p_workspace_id and wm.user_id = p_user_id;
  select * into strict v_subscription from subscriptions where workspace_id = p_workspace_id;

  v_plan := case
    when v_subscription.plan = 'free' then 'free'
    when v_subscription.status in ('trialing','active') then v_subscription.plan
    when v_subscription.status = 'grace_period' and v_subscription.grace_period_ends_at > now() then v_subscription.plan
    else 'free'
  end;
  select count(*)::integer into v_occupied from workspace_members where workspace_id = p_workspace_id;
  select count(*)::integer into v_pending from workspace_invitations where workspace_id = p_workspace_id and status = 'pending' and expires_at > now();

  select jsonb_agg(jsonb_build_object(
    'kind', kinds.kind,
    'used', coalesce(um.used, 0),
    'limit', billing_limit(v_plan, kinds.kind, v_subscription.seats),
    'remaining', greatest(0, billing_limit(v_plan, kinds.kind, v_subscription.seats) - coalesce(um.used, 0)),
    'resets_at', v_resets_at
  )) into v_usage
  from (values ('ai_explanation'), ('project_question'), ('indexed_project'), ('dictionary_item'), ('saved_item')) kinds(kind)
  left join usage_monthly um on um.workspace_id = p_workspace_id and um.kind = kinds.kind and um.period_start = v_period_start;

  return jsonb_build_object(
    'workspace', jsonb_build_object('id', v_workspace.id, 'name', v_workspace.name, 'type', v_workspace.type, 'role', v_workspace.role, 'owner_user_id', v_workspace.owner_user_id),
    'subscription', jsonb_build_object(
      'workspace_id', v_subscription.workspace_id, 'plan', v_plan, 'interval', v_subscription.interval, 'status', v_subscription.status,
      'seats', v_subscription.seats, 'stripe_customer_id', v_subscription.stripe_customer_id,
      'stripe_subscription_id', v_subscription.stripe_subscription_id, 'stripe_price_id', v_subscription.stripe_price_id,
      'current_period_start', v_subscription.current_period_start, 'current_period_end', v_subscription.current_period_end, 'grace_period_ends_at', v_subscription.grace_period_ends_at,
      'cancel_at_period_end', v_subscription.cancel_at_period_end
    ),
    'usage', v_usage,
    'occupied_seats', v_occupied,
    'pending_invitations', v_pending,
    'minimum_billable_seats', case when v_workspace.type = 'team' then greatest(2, v_occupied + v_pending) else 1 end,
    'can_manage_billing', v_workspace.role = 'owner',
    'can_manage_members', v_workspace.role in ('owner','admin')
  );
exception when no_data_found then
  raise exception 'Workspace not found or access denied';
end;
$$;

create or replace function reserve_billing_usage(p_user_id uuid, p_kind text, p_workspace_id uuid default null)
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

create or replace function list_workspace_invitations(p_user_id uuid, p_workspace_id uuid)
returns table(id uuid, workspace_id uuid, email text, role text, status text, expires_at timestamptz, created_at timestamptz)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from workspace_members where workspace_id = p_workspace_id and user_id = p_user_id and role in ('owner','admin')) then
    raise exception 'Only owners and admins can view invitations';
  end if;
  return query select wi.id, wi.workspace_id, wi.email, wi.role, wi.status, wi.expires_at, wi.created_at
  from workspace_invitations wi where wi.workspace_id = p_workspace_id order by wi.created_at desc;
end;
$$;

create or replace function list_workspace_members(p_user_id uuid, p_workspace_id uuid)
returns table(user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from workspace_members where workspace_id = p_workspace_id and user_id = p_user_id and role in ('owner','admin')) then
    raise exception 'Only owners and admins can view members';
  end if;
  return query select wm.user_id, u.email, wm.role, wm.joined_at
  from workspace_members wm join users u on u.id = wm.user_id
  where wm.workspace_id = p_workspace_id order by (wm.role = 'owner') desc, wm.joined_at;
end;
$$;

create or replace function change_workspace_member_role(p_user_id uuid, p_workspace_id uuid, p_member_user_id uuid, p_role text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_role not in ('admin','member') then raise exception 'Invalid member role'; end if;
  if not exists (select 1 from workspace_members where workspace_id = p_workspace_id and user_id = p_user_id and role = 'owner') then
    raise exception 'Only the owner can change member roles';
  end if;
  update workspace_members set role = p_role where workspace_id = p_workspace_id and user_id = p_member_user_id and role <> 'owner';
  if not found then raise exception 'Member not found or cannot be changed'; end if;
end;
$$;

create or replace function remove_workspace_member(p_user_id uuid, p_workspace_id uuid, p_member_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from workspace_members where workspace_id = p_workspace_id and user_id = p_member_user_id and role <> 'owner') then
    raise exception 'Member not found or cannot be removed';
  end if;
  if p_user_id <> p_member_user_id and not exists (select 1 from workspace_members where workspace_id = p_workspace_id and user_id = p_user_id and role = 'owner') then
    raise exception 'Only the owner can remove another member';
  end if;
  delete from workspace_members where workspace_id = p_workspace_id and user_id = p_member_user_id and role <> 'owner';
end;
$$;

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
  if v_overview #>> '{subscription,plan}' <> 'teams' then raise exception 'An active Teams plan is required to invite members'; end if;
  if (v_overview->>'occupied_seats')::integer + (v_overview->>'pending_invitations')::integer >= (v_overview #>> '{subscription,seats}')::integer then
    raise exception 'Add a paid seat before sending another invitation';
  end if;
  insert into workspace_invitations(workspace_id, email, role, token_hash, invited_by, expires_at)
  values (p_workspace_id, lower(trim(p_email)), p_role, p_token_hash, p_user_id, p_expires_at) returning * into v_row;
  return to_jsonb(v_row) - 'token_hash';
end;
$$;

create or replace function revoke_workspace_invitation(p_user_id uuid, p_workspace_id uuid, p_invitation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from workspace_members where workspace_id = p_workspace_id and user_id = p_user_id and role in ('owner','admin')) then
    raise exception 'Only owners and admins can revoke invitations';
  end if;
  update workspace_invitations set status = 'revoked' where id = p_invitation_id and workspace_id = p_workspace_id and status = 'pending';
  if not found then raise exception 'Pending invitation not found'; end if;
end;
$$;

create or replace function accept_workspace_invitation(p_user_id uuid, p_token_hash text)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_invitation workspace_invitations%rowtype; v_email text;
begin
  select * into strict v_invitation from workspace_invitations where token_hash = p_token_hash for update;
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then raise exception 'Invitation is invalid or expired'; end if;
  select lower(email) into v_email from users where id = p_user_id;
  if v_email is null or v_email <> v_invitation.email then raise exception 'Sign in with the invited email address'; end if;
  insert into workspace_members(workspace_id, user_id, role) values (v_invitation.workspace_id, p_user_id, v_invitation.role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
  update workspace_invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;
  return v_invitation.workspace_id;
exception when no_data_found then raise exception 'Invitation is invalid or expired';
end;
$$;

create or replace function change_workspace_seats(p_user_id uuid, p_workspace_id uuid, p_seats integer)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_minimum integer;
begin
  if not exists (select 1 from workspace_members where workspace_id = p_workspace_id and user_id = p_user_id and role = 'owner') then
    raise exception 'Only the workspace owner can change seats';
  end if;
  perform 1 from subscriptions where workspace_id = p_workspace_id for update;
  select greatest(2,
    (select count(*) from workspace_members where workspace_id = p_workspace_id) +
    (select count(*) from workspace_invitations where workspace_id = p_workspace_id and status = 'pending' and expires_at > now())
  ) into v_minimum;
  if p_seats < v_minimum or p_seats > 500 then raise exception 'Seat quantity is outside the allowed range'; end if;
  update subscriptions set seats = p_seats, updated_at = now() where workspace_id = p_workspace_id and plan = 'teams';
  if not found then raise exception 'An active Teams subscription is required'; end if;
end;
$$;

create or replace function delete_user_billing_data(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from workspaces where owner_user_id = p_user_id;
  delete from workspace_members where user_id = p_user_id;
end;
$$;

create or replace function claim_billing_webhook(p_event_id text, p_event_type text)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_status text;
begin
  insert into billing_webhook_events(stripe_event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (stripe_event_id) do update
    set status = 'processing', attempts = billing_webhook_events.attempts + 1, last_error = null
    where billing_webhook_events.status = 'failed'
  returning status into v_status;
  return v_status = 'processing';
end;
$$;

-- All billing data is server-mediated. RLS is defense in depth and browser roles receive no table privileges.
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table plan_entitlements enable row level security;
alter table subscriptions enable row level security;
alter table workspace_invitations enable row level security;
alter table checkout_intents enable row level security;
alter table billing_webhook_events enable row level security;
alter table usage_monthly enable row level security;
alter table usage_events enable row level security;
alter table billing_audit_log enable row level security;

revoke all on workspaces, workspace_members, plan_entitlements, subscriptions, workspace_invitations, checkout_intents,
  billing_webhook_events, usage_monthly, usage_events, billing_audit_log from anon, authenticated;
grant select, insert, update, delete on workspaces, workspace_members, plan_entitlements, subscriptions, workspace_invitations,
  checkout_intents, billing_webhook_events, usage_monthly, usage_events, billing_audit_log to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function ensure_personal_workspace(uuid), list_user_workspaces(uuid), get_workspace_access(uuid, uuid),
  create_team_workspace(uuid, text), billing_overview(uuid, uuid), reserve_billing_usage(uuid, text, uuid),
  list_workspace_invitations(uuid, uuid), create_workspace_invitation(uuid, uuid, text, text, text, timestamptz),
  list_workspace_members(uuid, uuid), change_workspace_member_role(uuid, uuid, uuid, text), remove_workspace_member(uuid, uuid, uuid),
  revoke_workspace_invitation(uuid, uuid, uuid), accept_workspace_invitation(uuid, text),
  change_workspace_seats(uuid, uuid, integer), delete_user_billing_data(uuid) from public, anon, authenticated;
revoke all on function claim_billing_webhook(text, text) from public, anon, authenticated;
grant execute on function ensure_personal_workspace(uuid), list_user_workspaces(uuid), get_workspace_access(uuid, uuid),
  create_team_workspace(uuid, text), billing_overview(uuid, uuid), reserve_billing_usage(uuid, text, uuid),
  list_workspace_invitations(uuid, uuid), create_workspace_invitation(uuid, uuid, text, text, text, timestamptz),
  list_workspace_members(uuid, uuid), change_workspace_member_role(uuid, uuid, uuid, text), remove_workspace_member(uuid, uuid, uuid),
  revoke_workspace_invitation(uuid, uuid, uuid), accept_workspace_invitation(uuid, text),
  change_workspace_seats(uuid, uuid, integer), delete_user_billing_data(uuid) to service_role;
grant execute on function claim_billing_webhook(text, text) to service_role;
