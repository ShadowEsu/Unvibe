-- Account deletion that really deletes (security finding D1).
--
--   * account_deletions: one row per account being deleted or deleted. No foreign key to users:
--     the users row goes away while this row stays. state is started until every step is done.
--     email is the address captured when the deletion started, so the email-keyed rows can still
--     be found after users is gone; it is cleared when the deletion is done. token_hashes are
--     sha256 hex of the app session tokens that asked for the deletion: a repeated DELETE whose
--     token is already gone (the first response was lost) is answered "already deleted".
--   * begin_account_deletion: records started (or adds one more token hash). A done row is
--     never reopened. Refuses (team_has_members), recording nothing, when the account owns a team
--     workspace with other members, because deleting the workspace would delete their learning
--     data; it locks the owned workspaces first, so a concurrent join either is seen here or is
--     refused by the membership trigger.
--   * erase_account_data: the public side in one transaction. Repeats the Teams refusal. Then
--     deletes or anonymises the email-keyed rows (waitlist, gift claims and redemptions, feedback
--     bonus grants, site feedback, invitations to the address), unless another account took the
--     address after the deletion started; keeps promo redemptions without the account or the
--     email; revokes the pending invitations the account sent in other teams; deletes owned
--     workspaces and memberships, then the users row. tokens, device codes, events and the rest
--     go with users by their on delete cascade, so until this commits the app token still works
--     for a retry.
--   * users_refuse_deleted_account: no users row can be created (insert or upsert) for an id with
--     a deletion row, so a session that outlives the deletion cannot re-create the account.
--   * workspace_members_refuse_deleted_account: nobody joins a workspace owned by an account
--     being deleted, and an account being deleted joins nothing.
--   * stale_account_deletions: how many deletions are still started after an hour (alerting).
--   * account_deletion_address_reused: whether another account took the address after the
--     deletion started; erase and the Blob step then leave that address's rows alone.
--
-- RLS is on with no policies; public, anon and authenticated have no table or function rights.
-- Only the service role (the API) reads the table and calls the functions, by explicit grants.
--
-- Rollback (forgets every deletion record; re-opens the re-creation path):
--   begin;
--   drop trigger if exists workspace_members_refuse_deleted_account on public.workspace_members;
--   drop trigger if exists users_refuse_deleted_account on public.users;
--   drop function if exists public.refuse_deleted_account_membership();
--   drop function if exists public.refuse_deleted_account();
--   drop function if exists public.erase_account_data(uuid);
--   drop function if exists public.begin_account_deletion(uuid, text, text);
--   drop function if exists public.stale_account_deletions(interval);
--   drop function if exists public.account_deletion_address_reused(uuid, text);
--   drop table if exists public.account_deletions;
--   commit;

begin;

create table if not exists public.account_deletions (
  user_id uuid primary key,
  state text not null default 'started' check (state in ('started', 'done')),
  -- The last step that finished, in this order. The Blob cleanup runs after the account rows are
  -- erased, so a Blob record that cannot be read never holds the account itself.
  step text not null default 'started' check (step in ('started', 'auth_identity', 'app_data', 'beta_downloads', 'done')),
  email text,
  token_hashes text[] not null default '{}',
  -- deleted: the Blob records for the email were removed (or there were none). no_email: no
  -- address was captured, so nothing was looked up. not_configured: this deployment has no Blob
  -- credentials, so the records were not looked up. email_reused: another account holds the
  -- address now, so the records are that account's and stay. failed: the last attempt threw; the
  -- row stays started, with the email, until a retry or a follow-up cleans up.
  beta_downloads text check (beta_downloads in ('deleted', 'no_email', 'not_configured', 'email_reused', 'failed')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  check (state = 'started' or (email is null and done_at is not null))
);
create index if not exists account_deletions_token_hashes_idx on public.account_deletions using gin (token_hashes);

alter table public.account_deletions enable row level security;
revoke all on table public.account_deletions from public, anon, authenticated, service_role;
-- The functions are security invoker and the API reads and updates the rows itself, so the service
-- role gets exactly these rights, by an explicit grant: Supabase's default privileges may give it
-- none of them or all of them (production gives all, delete and truncate included), and the revoke
-- above takes those back. No delete.
grant select, insert, update on table public.account_deletions to service_role;

create or replace function public.begin_account_deletion(p_user_id uuid, p_email text, p_token_hash text)
returns table(state text, step text, email text, beta_downloads text, started_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'token hash must be sha256 hex'; end if;
  -- Teams owners: refuse, recording nothing, while an owned team has another member. The row locks
  -- make a concurrent join wait for this transaction; its membership trigger then sees this row.
  perform 1 from public.workspaces w where w.owner_user_id = p_user_id for update;
  if exists (
    select 1 from public.workspaces w join public.workspace_members m on m.workspace_id = w.id
    where w.owner_user_id = p_user_id and w.type <> 'personal' and m.user_id <> p_user_id
  ) then
    raise exception 'team_has_members';
  end if;
  -- No email from the caller (its users read can fail): capture the users row's, in this insert.
  insert into public.account_deletions as d (user_id, email, token_hashes)
    values (p_user_id, coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''),
      (select nullif(lower(trim(u.email)), '') from public.users u where u.id = p_user_id)), array[p_token_hash])
  on conflict (user_id) do update
    set token_hashes = case when p_token_hash = any(d.token_hashes) then d.token_hashes else d.token_hashes || p_token_hash end,
        email = coalesce(d.email, excluded.email),
        updated_at = now()
    where d.state = 'started';
  return query select d.state, d.step, d.email, d.beta_downloads, d.started_at from public.account_deletions d where d.user_id = p_user_id;
end;
$$;
revoke all on function public.begin_account_deletion(uuid, text, text) from public, anon, authenticated;
grant execute on function public.begin_account_deletion(uuid, text, text) to service_role;

-- Deletions still started after p_older_than (1 hour by default): a failing step the person has not
-- retried, or Blob cleanup left for a follow-up. The deploy check and the alert read this count.
create or replace function public.stale_account_deletions(p_older_than interval default interval '1 hour')
returns integer
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select count(*)::integer from public.account_deletions d where d.state = 'started' and d.started_at < now() - p_older_than;
$$;
revoke all on function public.stale_account_deletions(interval) from public, anon, authenticated;
grant execute on function public.stale_account_deletions(interval) to service_role;

-- Whether p_email belongs to another account created after this deletion started (the person
-- signed up again once the Auth identity was gone). users.email is not unique (0001_init.sql), so
-- an older row with the same address does not count: it cannot stop the leaver's cleanup. Address
-- comparison is lower(trim()) on both sides, as everywhere in this migration.
create or replace function public.account_deletion_address_reused(p_user_id uuid, p_email text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.account_deletions d join public.users u on lower(trim(u.email)) = lower(trim(p_email))
    where d.user_id = p_user_id and u.id <> p_user_id and u.created_at > d.started_at
  );
$$;
revoke all on function public.account_deletion_address_reused(uuid, text) from public, anon, authenticated;
grant execute on function public.account_deletion_address_reused(uuid, text) to service_role;

create or replace function public.erase_account_data(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_emails text[];
begin
  select array_remove(array[d.email], null) into v_emails
    from public.account_deletions d where d.user_id = p_user_id and d.state = 'started' for update;
  if not found then raise exception 'account deletion was not started'; end if;
  v_emails := v_emails || coalesce((select array_agg(lower(trim(u.email))) from public.users u
    where u.id = p_user_id and coalesce(trim(u.email), '') <> ''), '{}');
  -- An address another account took after this deletion started (signed up again once the Auth
  -- identity went) is that account's: its email-keyed rows stay. This account's id-keyed rows go below.
  v_emails := array(select distinct e from unnest(v_emails) e where not public.account_deletion_address_reused(p_user_id, e));

  -- Teams owners, again inside this transaction (begin_account_deletion already refused, and the
  -- membership trigger refuses joins since): another member would lose their data with the workspace.
  perform 1 from public.workspaces w where w.owner_user_id = p_user_id for update;
  if exists (
    select 1 from public.workspaces w join public.workspace_members m on m.workspace_id = w.id
    where w.owner_user_id = p_user_id and w.type <> 'personal' and m.user_id <> p_user_id
  ) then
    raise exception 'team_has_members';
  end if;

  if cardinality(v_emails) > 0 then
    -- waitlist_entries and site_feedback are created by the site, not by these migrations.
    if to_regclass('public.waitlist_entries') is not null then
      execute 'delete from public.waitlist_entries where lower(trim(email)) = any($1)' using v_emails;
    end if;
    if to_regclass('public.site_feedback') is not null then
      execute 'delete from public.site_feedback where lower(trim(email)) = any($1)' using v_emails;
    end if;
    delete from public.bonus_pro_grants where lower(email) = any(v_emails);
    -- Gift rows also belong to the other person: they keep the row (it still counts toward their
    -- cap), and this account's address and its email-derived code are replaced.
    update public.gift_claims set giver_email = 'deleted:' || id::text, promo_code = 'deleted'
      where lower(giver_email) = any(v_emails);
    update public.gift_claims set receiver_email = 'deleted:' || id::text
      where lower(receiver_email) = any(v_emails);
    update public.gift_redemptions set giver_email = 'deleted:' || id::text, code = 'deleted', giver_user_id = null
      where lower(giver_email) = any(v_emails) or giver_user_id = p_user_id;
    update public.gift_redemptions set receiver_email = 'deleted:' || id::text, receiver_user_id = null
      where lower(receiver_email) = any(v_emails) or receiver_user_id = p_user_id;
    delete from public.workspace_invitations where email = any(v_emails);
  end if;
  -- The promo record stays (the code stays used and counts against its cap) without the account or email.
  update public.promo_redemptions set user_id = null, email = null where user_id = p_user_id;
  -- Invitations this account sent in someone else's team: a pending one is revoked (nobody joins on
  -- the word of an account that no longer exists); every one keeps its row, now under the team's
  -- owner, because invited_by cascades on the users row.
  update public.workspace_invitations i
    set invited_by = w.owner_user_id,
        status = case when i.status = 'pending' then 'revoked' else i.status end
    from public.workspaces w
    where i.workspace_id = w.id and i.invited_by = p_user_id and w.owner_user_id <> p_user_id;

  -- Billing and workspaces (owned workspaces first: the owner's membership cannot go before them).
  delete from public.workspaces where owner_user_id = p_user_id;
  delete from public.workspace_members where user_id = p_user_id;

  -- Last, the account. tokens and every other user_id row go by on delete cascade.
  delete from public.users where id = p_user_id;
  update public.account_deletions set step = 'app_data', updated_at = now() where user_id = p_user_id;
end;
$$;
revoke all on function public.erase_account_data(uuid) from public, anon, authenticated;
grant execute on function public.erase_account_data(uuid) to service_role;

create or replace function public.refuse_deleted_account()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.account_deletions d where d.user_id = new.id) then
    raise exception 'account_deleted';
  end if;
  return new;
end;
$$;
revoke all on function public.refuse_deleted_account() from public, anon, authenticated;
drop trigger if exists users_refuse_deleted_account on public.users;
create trigger users_refuse_deleted_account
  before insert on public.users
  for each row execute function public.refuse_deleted_account();

create or replace function public.refuse_deleted_account_membership()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Waits while begin_account_deletion holds the owner's workspace lock (for update). This function
  -- is volatile, so in read committed the next statement reads with a new snapshot and sees the
  -- deletion row that transaction committed.
  perform 1 from public.workspaces w where w.id = new.workspace_id for key share;
  if exists (
    select 1 from public.account_deletions d
    where d.user_id = new.user_id
       or d.user_id = (select w.owner_user_id from public.workspaces w where w.id = new.workspace_id and w.owner_user_id <> new.user_id)
  ) then
    raise exception 'account_deleted';
  end if;
  return new;
end;
$$;
revoke all on function public.refuse_deleted_account_membership() from public, anon, authenticated;
drop trigger if exists workspace_members_refuse_deleted_account on public.workspace_members;
create trigger workspace_members_refuse_deleted_account
  before insert on public.workspace_members
  for each row execute function public.refuse_deleted_account_membership();

commit;
