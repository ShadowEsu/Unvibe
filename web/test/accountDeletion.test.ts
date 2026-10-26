import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import { DELETE as deleteAccount, GET as accountInfo } from '../app/api/v1/account/route';
import { getBillingStore } from '../src/billing/store';
import { getStore } from '../src/data/store';
import { accountDeletionServices } from '../src/lib/accountDeletionServices';

// DELETE /api/v1/account with the memory stores, a fake Supabase Auth admin API and a fake Blob
// store. The SQL transaction itself is tested separately (erase_account_data, sqltest).
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';

type Step = 'begin' | 'blob' | 'auth' | 'erase' | 'finish';
let failOnce: Step | undefined;
function failing(step: Step): boolean {
  if (failOnce !== step) return false;
  failOnce = undefined;
  return true;
}

/** Supabase Auth: one identity per signed-up person. */
const identities = new Set<string>();
const authCalls: string[] = [];
const services = accountDeletionServices();
services.auth = {
  async deleteUser(userId) {
    authCalls.push(userId);
    if (failing('auth')) throw new Error('Supabase Auth delete failed: 500 unexpected_failure');
    return identities.delete(userId) ? 'deleted' : 'not_found';
  },
};

/** Blob beta-download records, by email; reading fails for the emails in brokenBlob. */
const betaRecords = new Map<string, number>();
const brokenBlob = new Set<string>();
services.betaDownloads = {
  async deleteForEmail(email) {
    if (failing('blob') || (email && brokenBlob.has(email))) throw new Error('Unsupported state or unable to authenticate data');
    if (email) betaRecords.delete(email);
    return 'deleted';
  },
};

const store = getStore();
const billing = getBillingStore();
const begin = store.beginAccountDeletion.bind(store);
const erase = store.eraseAccount.bind(store);
const finish = store.finishAccountDeletion.bind(store);
store.beginAccountDeletion = async (...args) => {
  if (failing('begin')) throw new Error('Could not start account deletion: connection reset');
  return begin(...args);
};
store.eraseAccount = async (userId) => {
  if (failing('erase')) throw new Error('Could not delete account data: canceling statement due to statement timeout');
  return erase(userId);
};
store.finishAccountDeletion = async (userId) => {
  if (failing('finish')) throw new Error('Could not finish account deletion: connection reset');
  return finish(userId);
};

/** Provisioning calls made while DELETE runs (it must make none). */
const provisioning: string[] = [];
const ensurePersonal = billing.ensurePersonalWorkspace.bind(billing);
const listWorkspaces = billing.listWorkspaces.bind(billing);
billing.ensurePersonalWorkspace = async (userId) => { provisioning.push(`ensurePersonalWorkspace ${userId}`); return ensurePersonal(userId); };
billing.listWorkspaces = async (userId) => { provisioning.push(`listWorkspaces ${userId}`); return listWorkspaces(userId); };

async function person(options: { personalWorkspace?: boolean } = {}) {
  const email = `delete-${randomUUID()}@account.test`;
  const account = await store.signIn(email);
  identities.add(account.userId);
  betaRecords.set(email, 2);
  if (options.personalWorkspace !== false) {
    const personal = await ensurePersonal(account.userId);
    await store.upsertEvents(account.userId, [{
      id: randomUUID(), ts: new Date().toISOString(), scope: 'selection', level: 'beginner', outcome: 'understood', concept: 'closures',
    }], personal.id);
  }
  return account;
}

async function remove(token: string) {
  provisioning.length = 0;
  const response = await deleteAccount(new Request('http://localhost/api/v1/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }));
  const body = await response.json() as Record<string, unknown>;
  assert.deepEqual(provisioning, [], 'DELETE never creates a workspace');
  return { status: response.status, body, cookie: response.headers.get('set-cookie') };
}

async function signedIn(token: string): Promise<boolean> {
  return (await accountInfo(new Request('http://localhost/api/v1/account', { headers: { authorization: `Bearer ${token}` } }))).status === 200;
}

/** Runs `work` with console.error captured; returns each logged line. */
async function capturingErrors(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  try {
    await work();
  } finally {
    console.error = original;
  }
  return lines;
}

async function assertGone(me: { userId: string; token: string; email: string }) {
  assert.equal(identities.has(me.userId), false, 'the Supabase Auth identity is deleted');
  assert.equal(betaRecords.has(me.email), false, 'the beta-download records are deleted');
  assert.equal(await store.userForToken(me.token), null, 'the app token is gone');
  assert.equal((await store.accountInfo(me.userId)).email, undefined, 'the users row is gone');
  assert.deepEqual(await store.history(me.userId, 10), [], 'the learning events are gone');
  assert.deepEqual(await billing.existingWorkspaces(me.userId), [], 'no workspace is left (or created) for the account');
  const deletion = await store.accountDeletion(me.userId);
  assert.ok(deletion);
  assert.equal(deletion.state, 'done');
  assert.equal(deletion.step, 'done');
  assert.equal(deletion.email, undefined, 'the email is forgotten');
  assert.equal(deletion.betaDownloads, 'deleted');
}

/** A team owned by `owner` with `member` in it, through the real invitation flow. */
async function teamWith(owner: { userId: string }, member?: { userId: string; email: string }) {
  const team = await billing.createTeamWorkspace(owner.userId, 'Study group');
  if (member) {
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await billing.createInvitation(owner.userId, team.id, member.email, 'member', hash, new Date(Date.now() + 86_400_000).toISOString());
    await billing.acceptInvitation(member.userId, hash, member.email);
  }
  return team;
}

test('deletes the sign-in identity, the beta-download records and the account, and answers deleted', async () => {
  const me = await person();
  const result = await remove(me.token);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, status: 'deleted' });
  assert.match(result.cookie ?? '', /^uncode_session=;.*Max-Age=0/, 'the browser session cookie is expired');
  assert.ok(authCalls.includes(me.userId), 'Supabase Auth was asked to delete the identity');
  await assertGone(me);
  assert.equal(await signedIn(me.token), false);
});

test('a lost response: the same token asks again and gets already_deleted', async () => {
  const me = await person();
  assert.equal((await remove(me.token)).body.status, 'deleted');
  const calls = authCalls.length;
  const again = await remove(me.token);
  assert.equal(again.status, 200);
  assert.deepEqual(again.body, { ok: true, status: 'already_deleted' });
  assert.equal(authCalls.length, calls, 'nothing is run again');
});

test('a token that never asked for a deletion is 401, not already_deleted', async () => {
  const result = await remove(randomUUID());
  assert.equal(result.status, 401);
});

for (const step of ['begin', 'auth', 'erase', 'blob', 'finish'] as const) {
  test(`a failure at "${step}" answers 503, reports nothing as done, and a retry with the same token completes`, async () => {
    const me = await person();
    failOnce = step;
    const first = await remove(me.token);
    assert.equal(first.status, 503);
    assert.equal(first.body.error, 'deletion_unavailable');
    assert.equal(first.body.ok, undefined, 'never reported as deleted');
    if (step === 'begin') {
      assert.equal(await store.accountDeletion(me.userId), null, 'nothing was started');
      assert.equal(identities.has(me.userId), true);
    } else {
      assert.equal((await store.accountDeletion(me.userId))?.state, 'started');
    }
    if (step === 'begin' || step === 'auth' || step === 'erase') {
      // The app token is the retry credential: it survives every failure before the transaction commits.
      assert.equal(await store.userForToken(me.token), me.userId, 'the app token still works for the retry');
    } else {
      // Blob and done run after the erase: the account is already gone, and the token-hash path resumes.
      assert.equal(await store.userForToken(me.token), null);
      assert.equal((await store.accountInfo(me.userId)).email, undefined, 'the account rows are erased');
    }
    const retry = await remove(me.token);
    assert.equal(retry.status, 200);
    assert.deepEqual(retry.body, { ok: true, status: 'deleted' });
    await assertGone(me);
  });
}

test('a Blob record that never reads: the account is erased, one retry gets 503, the next answers deleted and says what is left', async () => {
  const me = await person();
  brokenBlob.add(me.email);
  const logged = await capturingErrors(async () => {
    const first = await remove(me.token);
    assert.equal(first.status, 503);
    assert.match(String(first.body.message), /account and its data are deleted/);
    assert.equal(identities.has(me.userId), false, 'the Auth identity is gone');
    assert.equal((await store.accountInfo(me.userId)).email, undefined, 'the account rows are erased');
    assert.equal(await store.userForToken(me.token), null);
    const second = await remove(me.token);
    assert.equal(second.status, 200, 'no 503 for ever');
    assert.equal(second.body.status, 'deleted', 'the app clears its local data only on deleted');
    // The message says what is really left: the beta-download cleanup and the address kept for it.
    assert.match(String(second.body.message), /^Your account and app data are deleted\. We could not check for beta-download records just now; any we find, and the email address kept to find them, will be removed within 30 days\.$/);
  });
  const deletion = await store.accountDeletion(me.userId);
  assert.equal(deletion?.state, 'started', 'the row stays for the follow-up');
  assert.equal(deletion?.betaDownloads, 'failed');
  assert.equal(deletion?.email, me.email, 'the email stays only so the records can still be found');
  const pending = logged.find((line) => line.includes('ACCOUNT_DELETION_BLOB_PENDING'));
  assert.ok(pending, logged.join('\n'));
  assert.ok(!pending.includes(me.email) && !pending.includes(me.userId), 'no email or id in the log');
  // Once Blob reads again (the follow-up), the same token finishes the deletion.
  brokenBlob.delete(me.email);
  assert.deepEqual((await remove(me.token)).body, { ok: true, status: 'deleted' });
  await assertGone(me);
});

test('a deletion resumed more than an hour after it started logs ACCOUNT_DELETION_STALE, with no email or id', async () => {
  const me = await person();
  mock.timers.enable({ apis: ['Date'], now: Date.now() - 2 * 3_600_000 });
  failOnce = 'erase';
  try {
    assert.equal((await remove(me.token)).status, 503);
  } finally {
    mock.timers.reset();
  }
  const logged = await capturingErrors(async () => {
    assert.deepEqual((await remove(me.token)).body, { ok: true, status: 'deleted' });
  });
  const stale = logged.find((line) => line.includes('ACCOUNT_DELETION_STALE'));
  assert.ok(stale, logged.join('\n'));
  assert.match(stale, /"ageMinutes":1[2-9]\d/);
  assert.ok(!stale.includes(me.email) && !stale.includes(me.userId));
  await assertGone(me);
});

test('an address signed up again before the Blob step finishes keeps its beta-download records', async () => {
  const me = await person();
  failOnce = 'blob';
  assert.equal((await remove(me.token)).status, 503);
  // The account rows are erased; the person signs up again with the same address (a new id).
  const again = await store.signIn(me.email);
  assert.notEqual(again.userId, me.userId);
  betaRecords.set(me.email, 1);
  assert.deepEqual((await remove(me.token)).body, { ok: true, status: 'deleted' });
  assert.equal(betaRecords.get(me.email), 1, "the new account's records stay");
  const deletion = await store.accountDeletion(me.userId);
  assert.equal(deletion?.state, 'done');
  assert.equal(deletion.betaDownloads, 'email_reused');
  assert.equal(await store.userForToken(again.token), again.userId, 'the new account is signed in');
});

test('an identity Supabase Auth no longer has (user_not_found) counts as deleted', async () => {
  const me = await person();
  identities.delete(me.userId);
  const result = await remove(me.token);
  assert.deepEqual(result.body, { ok: true, status: 'deleted' });
  await assertGone(me);
});

test('a users read that returns no email at step 3 still deletes the beta-download records for the account\'s email', async () => {
  const me = await person();
  const accountInfo = store.accountInfo.bind(store);
  // SupabaseStore.accountInfo ignores a read error and returns no email.
  store.accountInfo = async (userId) => ({ userId });
  try {
    assert.deepEqual((await remove(me.token)).body, { ok: true, status: 'deleted' });
  } finally {
    store.accountInfo = accountInfo;
  }
  await assertGone(me);
});

test('an account that never had a workspace is deleted without one being created', async () => {
  const me = await person({ personalWorkspace: false });
  failOnce = 'finish';
  assert.equal((await remove(me.token)).status, 503);
  // The resumed DELETE finds no users row; provisioning here would create a workspace for a deleted id.
  assert.deepEqual((await remove(me.token)).body, { ok: true, status: 'deleted' });
  await assertGone(me);
});

test('a Teams owner with members gets 409 team_has_members and nothing is deleted', async () => {
  const owner = await person();
  const member = await person();
  const team = await teamWith(owner, member);
  const calls = authCalls.length;
  const result = await remove(owner.token);
  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { error: 'team_has_members', message: 'Remove the other members of your team on the Plan page, then delete your account.' });
  assert.equal(authCalls.length, calls, 'Supabase Auth was not called');
  assert.equal(identities.has(owner.userId), true);
  assert.equal(betaRecords.has(owner.email), true);
  assert.equal(await store.accountDeletion(owner.userId), null, 'no deletion was started');
  assert.equal(await signedIn(owner.token), true);
  assert.equal((await billing.listMembers(owner.userId, team.id)).length, 2, 'the team and its member are intact');
});

test('a member who joins between the Teams check and the start is refused at the start: 409, nothing deleted', async () => {
  const owner = await person();
  const member = await person();
  const team = await teamWith(owner);
  const listMembers = billing.listMembers.bind(billing);
  // The join lands right after step 2 read the (empty) team.
  billing.listMembers = async (userId, workspaceId) => {
    const seen = await listMembers(userId, workspaceId);
    billing.listMembers = listMembers;
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await billing.createInvitation(owner.userId, team.id, member.email, 'member', hash, new Date(Date.now() + 86_400_000).toISOString());
    await billing.acceptInvitation(member.userId, hash, member.email);
    return seen;
  };
  const calls = authCalls.length;
  const result = await remove(owner.token);
  billing.listMembers = listMembers;
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'team_has_members');
  assert.equal(authCalls.length, calls, 'Supabase Auth was not called');
  assert.equal(await store.accountDeletion(owner.userId), null, 'no deletion was started');
  assert.equal(await signedIn(owner.token), true, 'the owner can still remove the member');
  assert.equal((await billing.listMembers(owner.userId, team.id)).length, 2);
});

test('an owned team with no other members is deleted with the account', async () => {
  const owner = await person();
  const team = await teamWith(owner);
  assert.deepEqual((await remove(owner.token)).body, { ok: true, status: 'deleted' });
  assert.equal(await billing.getWorkspaceAccess(owner.userId, team.id), null);
  await assertGone(owner);
});

test('a member of someone else\'s team is deleted; the owner keeps the team and their data', async () => {
  const owner = await person();
  const member = await person();
  const team = await teamWith(owner, member);
  await store.upsertEvents(owner.userId, [{ id: randomUUID(), ts: new Date().toISOString(), scope: 'diff', level: 'advanced', outcome: 'reviewed', concept: 'joins' }], team.id);
  assert.deepEqual((await remove(member.token)).body, { ok: true, status: 'deleted' });
  await assertGone(member);
  assert.deepEqual((await billing.listMembers(owner.userId, team.id)).map((m) => m.userId), [owner.userId]);
  assert.equal((await store.workspaceHistoryPage(team.id, 10)).events.length, 1, 'the owner\'s team history is intact');
  assert.equal(await signedIn(owner.token), true);
  assert.equal(identities.has(owner.userId), true);
});
