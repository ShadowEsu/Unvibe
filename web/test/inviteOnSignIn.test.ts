import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { MemoryStore } from '../src/data/memoryStore';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';

const DAY = 86_400_000;

function inviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

async function team() {
  const learning = new MemoryStore();
  const billing = new MemoryBillingStore();
  const owner = (await learning.signIn('owner@team.test')).userId;
  const member = (await learning.signIn('member@team.test')).userId;
  const workspace = await billing.createTeamWorkspace(owner, 'Design team');
  return { billing, owner, member, workspace };
}

test('signing in with the invited email joins the workspace once, and the seat moves from pending to occupied', async () => {
  const { billing, owner, member, workspace } = await team();
  const { hash } = inviteToken();
  await billing.createInvitation(owner, workspace.id, 'member@team.test', 'member', hash, new Date(Date.now() + DAY).toISOString());
  const before = await billing.overview(owner, workspace.id);

  // The address the app signed in with may differ in case and spacing from the invitation.
  assert.deepEqual(await billing.acceptPendingInvitations(member, ' Member@Team.test '), [workspace.id]);
  const access = await billing.getWorkspaceAccess(member, workspace.id);
  assert.equal(access?.role, 'member');
  const after = await billing.overview(owner, workspace.id);
  assert.equal(after.pendingInvitations, before.pendingInvitations - 1);
  assert.equal(after.occupiedSeats, before.occupiedSeats + 1);

  // The next sign-in finds nothing left to accept, and the link now reads as used.
  assert.deepEqual(await billing.acceptPendingInvitations(member, 'member@team.test'), []);
  assert.equal((await billing.invitationPreview(hash))?.open, false);
});

test('another address, an expired invitation, a withdrawn one or no email joins nothing', async () => {
  const { billing, owner, member, workspace } = await team();
  const expired = inviteToken();
  await billing.createInvitation(owner, workspace.id, 'member@team.test', 'member', expired.hash, new Date(Date.now() - 1000).toISOString());
  assert.deepEqual(await billing.acceptPendingInvitations(member, 'member@team.test'), []);

  const withdrawn = inviteToken();
  const invitation = await billing.createInvitation(owner, workspace.id, 'member@team.test', 'member', withdrawn.hash, new Date(Date.now() + DAY).toISOString());
  await billing.revokeInvitation(owner, workspace.id, invitation.id);
  assert.deepEqual(await billing.acceptPendingInvitations(member, 'member@team.test'), []);

  const other = inviteToken();
  await billing.createInvitation(owner, workspace.id, 'someone-else@team.test', 'member', other.hash, new Date(Date.now() + DAY).toISOString());
  assert.deepEqual(await billing.acceptPendingInvitations(member, 'member@team.test'), []);
  assert.deepEqual(await billing.acceptPendingInvitations(member, undefined), []);
  assert.equal(await billing.getWorkspaceAccess(member, workspace.id), null);
});

test('an admin invitation joins as admin', async () => {
  const { billing, owner, member, workspace } = await team();
  await billing.createInvitation(owner, workspace.id, 'member@team.test', 'admin', inviteToken().hash, new Date(Date.now() + DAY).toISOString());
  await billing.acceptPendingInvitations(member, 'member@team.test');
  assert.equal((await billing.getWorkspaceAccess(member, workspace.id))?.role, 'admin');
});

test('someone already in the workspace keeps their role when an invitation to them is accepted', async () => {
  const { billing, owner, workspace } = await team();
  await billing.createInvitation(owner, workspace.id, 'owner@team.test', 'member', inviteToken().hash, new Date(Date.now() + DAY).toISOString());
  assert.deepEqual(await billing.acceptPendingInvitations(owner, 'owner@team.test'), [workspace.id]);
  assert.equal((await billing.getWorkspaceAccess(owner, workspace.id))?.role, 'owner');
});

test('the invite page preview shows the invited address and workspace, and nothing for an unknown link', async () => {
  const { billing, owner, workspace } = await team();
  const { hash } = inviteToken();
  await billing.createInvitation(owner, workspace.id, 'Member@Team.test', 'member', hash, new Date(Date.now() + DAY).toISOString());
  assert.deepEqual(await billing.invitationPreview(hash), { email: 'member@team.test', workspaceName: 'Design team', open: true });
  assert.equal(await billing.invitationPreview(inviteToken().hash), null);
});
