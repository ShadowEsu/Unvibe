import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import { DELETE as deleteAccount } from '../app/api/v1/account/route';
import { GET as sweepRoute } from '../app/api/v1/internal/account-deletions/sweep/route';
import { getStore } from '../src/data/store';
import { accountDeletionServices } from '../src/lib/accountDeletionServices';
import { SWEEP_LIMIT } from '../src/lib/accountDeletionSweep';

// The daily sweep with the memory store, a fake Supabase Auth admin API and a fake Blob store.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';
const SECRET = `cron-${randomUUID()}`;

const identities = new Set<string>();
let authDown = false;
const services = accountDeletionServices();
services.auth = {
  async deleteUser(userId) {
    if (authDown) throw new Error('Supabase Auth delete failed: 503 no status');
    return identities.delete(userId) ? 'deleted' : 'not_found';
  },
};

/** Blob beta-download records by email; reading fails for the emails in brokenBlob. Every attempt is logged. */
const betaRecords = new Map<string, number>();
const brokenBlob = new Set<string>();
const blobAttempts: string[] = [];
services.betaDownloads = {
  async deleteForEmail(email) {
    if (email) blobAttempts.push(email);
    if (email && brokenBlob.has(email)) throw new Error('Unsupported state or unable to authenticate data');
    if (email) betaRecords.delete(email);
    return 'deleted';
  },
};

const store = getStore();

function sweep(authorization?: string): Promise<Response> {
  return sweepRoute(new Request('http://localhost/api/v1/internal/account-deletions/sweep', authorization ? { headers: { authorization } } : {}));
}

function remove(token: string): Promise<Response> {
  return deleteAccount(new Request('http://localhost/api/v1/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }));
}

/** Runs `work` with Date (and so every store clock) set `ageMs` in the past. */
async function agoBy<T>(ageMs: number, work: () => Promise<T>): Promise<T> {
  mock.timers.enable({ apis: ['Date'], now: Date.now() - ageMs });
  try {
    return await work();
  } finally {
    mock.timers.reset();
  }
}

/** A person whose deletion, `ageMs` ago, ended after the second Blob failure: deleted, row still started. */
async function leftForTheSweep(ageMs: number) {
  const email = `sweep-${randomUUID()}@account.test`;
  const me = await store.signIn(email);
  identities.add(me.userId);
  betaRecords.set(email, 1);
  brokenBlob.add(email);
  await agoBy(ageMs, async () => {
    assert.equal((await remove(me.token)).status, 503);
    const second = await remove(me.token);
    assert.equal(second.status, 200);
    assert.equal(((await second.json()) as { status?: string }).status, 'deleted');
  });
  const deletion = await store.accountDeletion(me.userId);
  assert.equal(deletion?.state, 'started');
  assert.equal(deletion.betaDownloads, 'failed');
  return { ...me, email };
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

test('without CRON_SECRET (or with a short one) the sweep refuses every call: fail closed', async () => {
  delete process.env.CRON_SECRET;
  const stuck = await leftForTheSweep(2 * 3_600_000);
  for (const authorization of [undefined, 'Bearer ', 'Bearer undefined']) {
    assert.equal((await sweep(authorization)).status, 503);
  }
  process.env.CRON_SECRET = 'short';
  assert.equal((await sweep('Bearer short')).status, 503, 'a secret under 16 characters is not configured');
  assert.equal((await store.accountDeletion(stuck.userId))?.state, 'started', 'nothing ran');
  brokenBlob.delete(stuck.email);
});

test('the sweep needs the exact bearer secret: none, wrong or longer is 401 and runs nothing', async () => {
  process.env.CRON_SECRET = SECRET;
  const attempts = blobAttempts.length;
  for (const authorization of [undefined, `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, SECRET, `Basic ${SECRET}`, 'Bearer wrong']) {
    const refused = await sweep(authorization);
    assert.equal(refused.status, 401, String(authorization));
  }
  assert.equal(blobAttempts.length, attempts, 'no deletion step ran');
  assert.equal((await sweep(`Bearer ${SECRET}`)).status, 200);
});

test('a stale row whose Blob step now works becomes done, the email forgotten and the records gone', async () => {
  process.env.CRON_SECRET = SECRET;
  const stuck = await leftForTheSweep(2 * 3_600_000);
  brokenBlob.delete(stuck.email);
  const answer = await sweep(`Bearer ${SECRET}`);
  assert.equal(answer.status, 200);
  const counts = await answer.json() as Record<string, unknown>;
  assert.ok(Number(counts.done) >= 1, JSON.stringify(counts));
  const deletion = await store.accountDeletion(stuck.userId);
  assert.ok(deletion);
  assert.equal(deletion.state, 'done');
  assert.equal(deletion.step, 'done');
  assert.equal(deletion.email, undefined, 'the email is nulled');
  assert.equal(deletion.betaDownloads, 'deleted');
  assert.equal(betaRecords.has(stuck.email), false);
  assert.equal(JSON.stringify(counts).includes(stuck.email) || JSON.stringify(counts).includes(stuck.userId), false, 'counts only');
});

test('a row left after an Auth failure is finished too: identity, account rows, records, done', async () => {
  process.env.CRON_SECRET = SECRET;
  const email = `sweep-auth-${randomUUID()}@account.test`;
  const me = await store.signIn(email);
  identities.add(me.userId);
  betaRecords.set(email, 1);
  await agoBy(2 * 3_600_000, async () => {
    authDown = true;
    try {
      assert.equal((await remove(me.token)).status, 503);
    } finally {
      authDown = false;
    }
  });
  assert.equal(await store.userForToken(me.token), me.userId, 'not erased yet');
  assert.equal((await sweep(`Bearer ${SECRET}`)).status, 200);
  assert.equal(identities.has(me.userId), false);
  assert.equal(await store.userForToken(me.token), null);
  assert.equal(betaRecords.has(email), false);
  assert.equal((await store.accountDeletion(me.userId))?.state, 'done');
});

test('a row whose Blob step still fails stays started, recorded failed, with the email kept for the cleanup', async () => {
  process.env.CRON_SECRET = SECRET;
  const stuck = await leftForTheSweep(2 * 3_600_000);
  const counts = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, number>;
  assert.ok(counts.cleanupPending >= 1 && counts.stale >= 1, JSON.stringify(counts));
  const deletion = await store.accountDeletion(stuck.userId);
  assert.equal(deletion?.state, 'started');
  assert.equal(deletion.betaDownloads, 'failed');
  assert.equal(deletion.email, stuck.email);
  assert.ok(blobAttempts.includes(stuck.email));
});

test('a deletion under an hour old is left to the person\'s own retry', async () => {
  process.env.CRON_SECRET = SECRET;
  const fresh = await leftForTheSweep(10 * 60_000);
  brokenBlob.delete(fresh.email);
  await sweep(`Bearer ${SECRET}`);
  assert.equal((await store.accountDeletion(fresh.userId))?.state, 'started', 'not stale yet');
  assert.equal(betaRecords.has(fresh.email), true);
});

test('a row still started after 7 days logs ACCOUNT_DELETION_OVERDUE with counts only', async () => {
  process.env.CRON_SECRET = SECRET;
  const overdue = await leftForTheSweep(8 * 24 * 3_600_000);
  let counts: Record<string, number> = {};
  const logged = await capturingErrors(async () => {
    counts = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, number>;
  });
  assert.ok(counts.overdue >= 1, JSON.stringify(counts));
  const lines = logged.filter((line) => line.includes('ACCOUNT_DELETION_OVERDUE'));
  assert.equal(lines.length, 1, logged.join('\n'));
  const payload = JSON.parse(lines[0].slice(lines[0].indexOf('{'))) as Record<string, unknown>;
  assert.deepEqual(Object.keys(payload).sort(), ['checked', 'cleanupPending', 'code', 'done', 'failed', 'overdue', 'stale']);
  assert.ok(Object.entries(payload).every(([key, value]) => key === 'code' || typeof value === 'number'));
  for (const line of logged) {
    assert.ok(!line.includes(overdue.email) && !line.includes(overdue.userId), `no email or id: ${line}`);
  }
  // Fixed: the next run finishes it and the alert stops.
  brokenBlob.delete(overdue.email);
  let after: Record<string, number> = {};
  const quiet = await capturingErrors(async () => { after = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, number>; });
  assert.equal((await store.accountDeletion(overdue.userId))?.state, 'done');
  assert.equal(after.overdue, 0);
  assert.ok(!quiet.some((line) => line.includes('ACCOUNT_DELETION_OVERDUE')), quiet.join('\n'));
});

test(`one run retries at most ${SWEEP_LIMIT} rows, and the next run reaches the rest`, async () => {
  process.env.CRON_SECRET = SECRET;
  const many = [];
  for (let i = 0; i < SWEEP_LIMIT + 2; i += 1) many.push(await leftForTheSweep(2 * 3_600_000));
  const before = blobAttempts.length;
  const first = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, number>;
  assert.equal(first.checked, SWEEP_LIMIT);
  assert.equal(blobAttempts.length - before, SWEEP_LIMIT, 'no more Blob work than the cap');
  await sweep(`Bearer ${SECRET}`);
  const reached = new Set(blobAttempts.slice(before));
  assert.ok(many.every((row) => reached.has(row.email)), 'least recently tried first: two runs reach every row');
});
