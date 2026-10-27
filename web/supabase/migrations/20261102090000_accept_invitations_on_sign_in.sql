-- Invited teammates join their workspace when they sign in to the desktop app.
--
-- The desktop app is the only sign-in: the person approves it on /activate, and
-- POST /api/v1/auth/approve runs approve_device_code, which writes their verified email to users.
-- Until now a seat attached only through the invite link's token plus a web session, which a
-- teammate never has. After approve_device_code, the API calls accept_pending_invitations: every
-- pending, unexpired invitation sent to that email joins the person to its workspace. The seat was
-- reserved when the invitation was made (create_workspace_invitation counts pending invitations
-- against the paid seats), so this never adds a seat.
--
-- Same checks as accept_workspace_invitation, matched by email instead of token. Differences: a
-- person already in the workspace keeps their role (on conflict do nothing), and an unknown or
-- missing email joins nothing instead of raising, so a sign-in never fails because of an invitation.
-- Rows are locked in created_at order, so two approvals at once can't accept one invitation twice.

create or replace function public.accept_pending_invitations(p_user_id uuid)
returns setof uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_email text; v_invitation workspace_invitations%rowtype;
begin
  select lower(email) into v_email from users where id = p_user_id;
  if v_email is null then return; end if;
  for v_invitation in
    select * from workspace_invitations
    where email = v_email and status = 'pending' and expires_at > now()
    order by created_at
    for update
  loop
    insert into workspace_members(workspace_id, user_id, role)
      values (v_invitation.workspace_id, p_user_id, v_invitation.role)
      on conflict (workspace_id, user_id) do nothing;
    update workspace_invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;
    return next v_invitation.workspace_id;
  end loop;
end;
$$;

revoke all on function public.accept_pending_invitations(uuid) from public, anon, authenticated;
grant execute on function public.accept_pending_invitations(uuid) to service_role;
