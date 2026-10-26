import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import Stripe from 'stripe';
import { DELETE as deleteAccount } from '../app/api/v1/account/route';
import { GET as sweepRoute } from '../app/api/v1/internal/account-deletions/sweep/route';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';
import { getStore } from '../src/data/store';
import { accountDeletionServices } from '../src/lib/accountDeletionServices';
import { SWEEP_LIMIT, sweepAccountDeletions, type SweepCounts } from '../src/lib/accountDeletionSweep';

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

/** Live Stripe subscriptions by id; the cached client's retrieve is replaced so nothing leaves the machine. */
const live = new Map<string, Stripe.Subscription | Error>();
const subscriptionsApi = getStripe().subscriptions;
subscriptionsApi.retrieve = (async (id: string) => {
  const found = live.get(id);
  if (!found) throw new Error(`unknown subscription ${id}`);
  if (found instanceof Error) throw found;
  return found;
}) as unknown as typeof subscriptionsApi.retrieve;

function liveSubscription(id: string, fields: Partial<Pick<Stripe.Subscription, 'status' | 'cancel_at_period_end'>>): Stripe.Subscription {
  return {
    id, status: 'active', cancel_at_period_end: false, cancel_at: null,
    items: { data: [{ current_period_end: 1_800_000_000 }] },
    ...fields,
  } as unknown as Stripe.Subscription;
}

/**
 * Blob beta-download records by email; reading fails for the emails in brokenBlob, and waits while
 * blobStall is set (calling onStall first). Every attempt is logged.
 */
const betaRecords = new Map<string, number>();
const brokenBlob = new Set<string>();
const blobAttempts: string[] = [];
let blobStall: { until: Promise<void>; onStall: () => void } | undefined;
services.betaDownloads = {
  async deleteForEmail(email) {
    if (email) blobAttempts.push(email);
    if (blobStall) {
      blobStall.onStall();
      await blobStall.until;
    }
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

/** Runs `work` with console.log and console.error captured; returns each logged line. */
async function capturingLogs(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = { log: console.log, error: console.error };
  console.log = console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  try {
    await work();
  } finally {
    console.log = original.log;
    console.error = original.error;
  }
  return lines;
}

/** The one ACCOUNT_DELETION_SWEEP counts line among `lines`, parsed; fails unless there is exactly one. */
function countsLine(lines: string[]): Record<string, unknown> {
  const found = lines.filter((line) => line.startsWith('account deletion sweep: counts {"code":"ACCOUNT_DELETION_SWEEP",'));
  assert.equal(found.length, 1, lines.join('\n'));
  const payload = JSON.parse(found[0].slice(found[0].indexOf('{'))) as Record<string, unknown>;
  assert.deepEqual(Object.keys(payload), ['code', 'found', 'checked', 'done', 'cleanupPending', 'failed', 'skipped', 'stale', 'overdue', 'stoppedOnBudget']);
  return payload;
}

test('with nothing to retry, the sweep still logs its counts line', async () => {
  process.env.CRON_SECRET = SECRET;
  let answer: Record<string, unknown> = {};
  const logged = await capturingLogs(async () => { answer = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, unknown>; });
  const counts = countsLine(logged);
  assert.deepEqual(counts, { code: 'ACCOUNT_DELETION_SWEEP', found: 0, checked: 0, done: 0, cleanupPending: 0, failed: 0, skipped: 0, stale: 0, overdue: 0, stoppedOnBudget: false });
  assert.deepEqual(answer, { ok: true, found: 0, checked: 0, done: 0, cleanupPending: 0, failed: 0, skipped: 0, stale: 0, overdue: 0, stoppedOnBudget: false });
});

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

test('the sweep needs the exact bearer secret: none, wrong or longer is 401, logged, and runs nothing', async () => {
  process.env.CRON_SECRET = SECRET;
  const attempts = blobAttempts.length;
  for (const authorization of [undefined, `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, SECRET, `Basic ${SECRET}`, 'Bearer wrong']) {
    let status = 0;
    const logged = await capturingLogs(async () => { status = (await sweep(authorization)).status; });
    assert.equal(status, 401, String(authorization));
    // One fixed line, with nothing from the request header in it.
    assert.deepEqual(logged, ['account deletion sweep: unauthorized call refused {"code":"ACCOUNT_DELETION_SWEEP_UNAUTHORIZED"}'], String(authorization));
  }
  assert.equal(blobAttempts.length, attempts, 'no deletion step ran');
  assert.equal((await sweep(`Bearer ${SECRET}`)).status, 200);
});

test('a stale row whose Blob step now works becomes done, the email forgotten and the records gone', async () => {
  process.env.CRON_SECRET = SECRET;
  const stuck = await leftForTheSweep(2 * 3_600_000);
  brokenBlob.delete(stuck.email);
  let answer: Response | undefined;
  const logged = await capturingLogs(async () => { answer = await sweep(`Bearer ${SECRET}`); });
  assert.ok(answer);
  assert.equal(answer.status, 200);
  const counts = await answer.json() as Record<string, unknown>;
  assert.ok(Number(counts.done) >= 1, JSON.stringify(counts));
  const line = countsLine(logged);
  assert.equal(line.done, counts.done, 'the log line carries the same counts');
  assert.ok(logged.every((entry) => !entry.includes(stuck.email) && !entry.includes(stuck.userId)), logged.join('\n'));
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

/**
 * A person with a personal workspace whose deletion, 2 hours ago, stopped at the Auth step: the
 * account data is not erased. With `subscribed`, a Pro subscription set to cancel at period end
 * (so DELETE's preflight let it through) is stored and live at Stripe.
 */
async function stoppedBeforeErase(subscribed: boolean) {
  const me = await store.signIn(`sweep-billing-${randomUUID()}@account.test`);
  identities.add(me.userId);
  const workspace = await getBillingStore().ensurePersonalWorkspace(me.userId);
  const subscriptionId = `sub_${randomUUID()}`;
  if (subscribed) {
    await getBillingStore().syncSubscription({
      workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
      stripeCustomerId: `cus_${randomUUID()}`, stripePriceId: 'price_test_sweep', cancelAtPeriodEnd: true, stripeSubscriptionId: subscriptionId,
    });
    live.set(subscriptionId, liveSubscription(subscriptionId, { cancel_at_period_end: true }));
  }
  await agoBy(2 * 3_600_000, async () => {
    authDown = true;
    try {
      assert.equal((await remove(me.token)).status, 503);
    } finally {
      authDown = false;
    }
  });
  assert.equal((await store.accountDeletion(me.userId))?.step, 'started');
  return { ...me, subscriptionId };
}

/** Nothing of the account was touched: identity, token, workspace, and a started row with its email. */
async function untouched(me: { userId: string; token: string; email: string }) {
  assert.equal(identities.has(me.userId), true, 'the sign-in identity is kept');
  assert.equal(await store.userForToken(me.token), me.userId, 'the account data is not erased');
  assert.equal((await getBillingStore().existingWorkspaces(me.userId)).length, 1, 'the workspace is kept');
  const deletion = await store.accountDeletion(me.userId);
  assert.equal(deletion?.state, 'started');
  assert.equal(deletion.step, 'started');
  assert.equal(deletion.email, me.email);
}

test('before the erase, a row whose subscription can charge again is skipped and counted, not erased', async () => {
  process.env.CRON_SECRET = SECRET;
  const me = await stoppedBeforeErase(true);
  // "Don't cancel" in the portal after the deletion stopped: Stripe will charge again.
  live.set(me.subscriptionId, liveSubscription(me.subscriptionId, { cancel_at_period_end: false }));
  let counts: Record<string, unknown> = {};
  const logged = await capturingLogs(async () => { counts = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, unknown>; });
  assert.equal(counts.skipped, 1, JSON.stringify(counts));
  assert.equal(countsLine(logged).skipped, 1);
  assert.ok(logged.includes('account deletion sweep: skipped, a subscription can still charge'), logged.join('\n'));
  await untouched(me);
  // Once it is canceled, the next run finishes the deletion.
  live.set(me.subscriptionId, liveSubscription(me.subscriptionId, { status: 'canceled' }));
  await sweep(`Bearer ${SECRET}`);
  assert.equal((await store.accountDeletion(me.userId))?.state, 'done');
  assert.deepEqual(await getBillingStore().existingWorkspaces(me.userId), []);
});

test('before the erase, a row whose billing cannot be read is skipped and counted, not erased', async () => {
  process.env.CRON_SECRET = SECRET;
  const me = await stoppedBeforeErase(true);
  live.set(me.subscriptionId, new Stripe.errors.StripeConnectionError({ message: 'An error occurred with our connection to Stripe.' }));
  let counts: Record<string, unknown> = {};
  const logged = await capturingLogs(async () => { counts = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, unknown>; });
  assert.equal(counts.skipped, 1, JSON.stringify(counts));
  assert.ok(logged.some((line) => line.startsWith('account deletion sweep: skipped, subscription check failed')), logged.join('\n'));
  await untouched(me);
  live.set(me.subscriptionId, liveSubscription(me.subscriptionId, { cancel_at_period_end: true }));
  await sweep(`Bearer ${SECRET}`);
  assert.equal((await store.accountDeletion(me.userId))?.state, 'done');
});

test('before the erase, a row with a workspace and no subscription goes ahead', async () => {
  process.env.CRON_SECRET = SECRET;
  const me = await stoppedBeforeErase(false);
  const counts = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, unknown>;
  assert.equal(counts.skipped, 0, JSON.stringify(counts));
  assert.equal(identities.has(me.userId), false);
  assert.equal(await store.userForToken(me.token), null);
  assert.deepEqual(await getBillingStore().existingWorkspaces(me.userId), []);
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
  const logged = await capturingLogs(async () => {
    counts = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, number>;
  });
  assert.ok(counts.overdue >= 1, JSON.stringify(counts));
  const lines = logged.filter((line) => line.includes('ACCOUNT_DELETION_OVERDUE'));
  assert.equal(lines.length, 1, logged.join('\n'));
  const payload = JSON.parse(lines[0].slice(lines[0].indexOf('{'))) as Record<string, unknown>;
  assert.deepEqual(Object.keys(payload).sort(), ['checked', 'cleanupPending', 'code', 'done', 'failed', 'found', 'overdue', 'skipped', 'stale', 'stoppedOnBudget']);
  assert.ok(Object.entries(payload).every(([key, value]) => key === 'code' || typeof value === (key === 'stoppedOnBudget' ? 'boolean' : 'number')));
  assert.equal(countsLine(logged).overdue, counts.overdue);
  for (const line of logged) {
    assert.ok(!line.includes(overdue.email) && !line.includes(overdue.userId), `no email or id: ${line}`);
  }
  // Fixed: the next run finishes it and the alert stops.
  brokenBlob.delete(overdue.email);
  let after: Record<string, number> = {};
  const quiet = await capturingLogs(async () => { after = await (await sweep(`Bearer ${SECRET}`)).json() as Record<string, number>; });
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

test('a run the time budget stops still logs its counts line, with the overdue rows counted before the loop', async () => {
  process.env.CRON_SECRET = SECRET;
  const overdue = await leftForTheSweep(8 * 24 * 3_600_000);
  brokenBlob.delete(overdue.email);
  // Every Blob step now hangs. ES2022 lib: no Promise.withResolvers.
  let release = () => {};
  let stalled = () => {};
  const reachedBlob = new Promise<void>((resolve) => { stalled = resolve; });
  blobStall = { until: new Promise<void>((resolve) => { release = resolve; }), onStall: () => stalled() };
  // Once the rows are listed the time is gone: a count after the loop would fail the run.
  let listed = false;
  const timed = Object.create(store) as typeof store;
  timed.staleAccountDeletions = async (olderThanMs, limit) => {
    listed = true;
    return store.staleAccountDeletions(olderThanMs, limit);
  };
  timed.staleAccountDeletionCount = async (olderThanMs) => {
    if (listed) throw new Error('counted after the loop');
    return store.staleAccountDeletionCount(olderThanMs);
  };
  // The budget's clock is driven by hand: the run is stuck on its first row until 100 ms "pass".
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  let counts: SweepCounts | undefined;
  let settled = false;
  const logged: string[] = [];
  try {
    const run = capturingLogs(async () => { counts = await sweepAccountDeletions(timed, 100); }).then((lines) => { logged.push(...lines); settled = true; });
    await reachedBlob;
    mock.timers.tick(100);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, true, 'the run stopped at its budget while the row was still running');
    await run;
  } finally {
    mock.timers.reset();
    release();
    blobStall = undefined;
  }
  assert.ok(counts);
  assert.equal(counts.stoppedOnBudget, true);
  assert.equal(counts.checked, 0, 'the row cut off is not counted as retried');
  assert.ok(counts.found >= 1 && counts.overdue >= 1 && counts.stale >= 1, JSON.stringify(counts));
  const line = countsLine(logged);
  assert.equal(line.stoppedOnBudget, true);
  assert.equal(line.overdue, counts.overdue);
  assert.equal(logged.filter((entry) => entry.includes('ACCOUNT_DELETION_OVERDUE')).length, 1, logged.join('\n'));
  assert.ok(logged.every((entry) => !entry.includes(overdue.email) && !entry.includes(overdue.userId)), logged.join('\n'));
  // The budget leaves the rows as they were; full runs finish them.
  await sweep(`Bearer ${SECRET}`);
  await sweep(`Bearer ${SECRET}`);
  assert.equal((await store.accountDeletion(overdue.userId))?.state, 'done');
});
