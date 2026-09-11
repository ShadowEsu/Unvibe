import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { MemoryStore } from '../src/data/memoryStore';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';

test('event upsert stamps workspace and team history shows authorship', async () => {
  const learning = new MemoryStore();
  const billing = new MemoryBillingStore();
  const ownerAccount = await learning.signIn('owner@teams.test');
  const memberAccount = await learning.signIn('member@teams.test');
  const owner = ownerAccount.userId;
  const member = memberAccount.userId;
  const team = await billing.createTeamWorkspace(owner, 'Founding pilot');
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await billing.createInvitation(owner, team.id, 'member@teams.test', 'member', hash, new Date(Date.now() + 86_400_000).toISOString());
  await billing.acceptInvitation(member, hash, 'member@teams.test');

  await learning.upsertEvents(owner, [{
    id: randomUUID(),
    ts: '2026-09-08T10:00:00.000Z',
    scope: 'selection',
    level: 'intermediate',
    outcome: 'understood',
    file: 'app/src/main.ts',
    concept: 'ipc',
    project: 'Unvibe',
  }], team.id);

  await learning.upsertEvents(member, [{
    id: randomUUID(),
    ts: '2026-09-08T11:00:00.000Z',
    scope: 'diff',
    level: 'advanced',
    outcome: 'needs_review',
    file: 'web/src/billing/plans.ts',
    concept: 'billing',
    project: 'Unvibe',
  }], team.id);

  const page = await learning.workspaceHistoryPage(team.id, 20);
  assert.equal(page.events.length, 2);
  assert.equal(page.events[0]?.authorEmail, 'member@teams.test');
  assert.equal(page.events[0]?.authorUserId, member);
  assert.equal(page.events[1]?.authorEmail, 'owner@teams.test');
  assert.equal(page.events[1]?.file, 'app/src/main.ts');

  const personal = await learning.history(owner, 10);
  assert.equal(personal.length, 1);
  assert.equal(personal[0]?.file, 'app/src/main.ts');

  const projects = await learning.workspaceProjects(team.id);
  assert.equal(projects[0]?.name, 'Unvibe');
  assert.equal(projects[0]?.reviews, 2);

  const members = await billing.listMembers(member, team.id);
  assert.equal(members.length, 2);

  const stranger = randomUUID();
  const access = await billing.getWorkspaceAccess(stranger, team.id);
  assert.equal(access, null);
});

test('personal history stays empty of teammate events without shared workspace stamp', async () => {
  const learning = new MemoryStore();
  const a = await learning.signIn('a@solo.test');
  const b = await learning.signIn('b@solo.test');
  await learning.upsertEvents(a.userId, [{
    id: randomUUID(),
    ts: '2026-09-08T12:00:00.000Z',
    scope: 'selection',
    level: 'beginner',
    outcome: 'reviewed',
    file: 'solo.ts',
  }]);
  const historyB = await learning.history(b.userId, 10);
  assert.equal(historyB.length, 0);
  const teamFeed = await learning.workspaceHistoryPage(randomUUID(), 10);
  assert.equal(teamFeed.events.length, 0);
});
