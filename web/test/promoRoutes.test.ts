import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import test from 'node:test';
import { GET as adminGet, POST as adminPost } from '../app/api/v1/admin/promo/route';
import { POST as redeemRoute } from '../app/api/v1/promo/redeem/route';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { getBillingStore, resetBillingStoreCacheForTests } from '../src/billing/store';
import { seedMemoryPromoBatch } from '../src/billing/promo';
import { getStore, resetStoreCacheForTests } from '../src/data/store';
import { formatPromoCode, PROMO_ALPHABET, promoCodeHash } from '../src/lib/promoCode';

// Real routes on the memory backends (no database): the memory promo backend mirrors the SQL
// redeem_promo_code / revoke_promo_code, which ~/unvibe-e2e/promo/sqltest/run.mjs tests on Postgres.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef';
process.env.UNVIBE_ADMIN_STATS_TOKEN = ADMIN_TOKEN;

const DAY_MS = 24 * 60 * 60 * 1000;

function resetStores(): void {
  const g = globalThis as unknown as { __uncodeData?: unknown; __uncodeBillingData?: unknown; __unvibePromo?: unknown };
  g.__uncodeData = undefined;
  g.__uncodeBillingData = undefined;
  g.__unvibePromo = undefined;
  resetStoreCacheForTests();
  resetBillingStoreCacheForTests();
}

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

function newCode(): string {
  return Array.from({ length: 16 }, () => PROMO_ALPHABET[randomInt(32)]).join('');
}

/** A batch like calhacks13, seeded the way the hash-only SQL insert seeds production. */
function batch(id: string, n: number, options: { months?: number; cap?: number; redeemBy?: string; revokedAt?: string } = {}): string[] {
  const codes = Array.from({ length: n }, newCode);
  seedMemoryPromoBatch({
    id,
    months: options.months ?? 3,
    maxRedemptions: options.cap ?? 300,
    redeemBy: options.redeemBy ?? new Date(Date.now() + 30 * DAY_MS).toISOString(),
    revokedAt: options.revokedAt ?? null,
  }, codes.map(promoCodeHash));
  return codes;
}

/** A signed-in person: in memory mode their session token stands in for a Supabase access token. */
async function person(label: string): Promise<{ userId: string; token: string }> {
  const account = await getStore().signIn(`${label}-${randomUUID()}@promo.test`);
  return { userId: account.userId, token: account.token };
}

async function payingPerson(): Promise<{ userId: string; token: string }> {
  const p = await person('paid');
  const workspace = await getBillingStore().ensurePersonalWorkspace(p.userId);
  await getBillingStore().syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `sub_${randomUUID()}`, stripePriceId: 'price_test_promo',
    currentPeriodEnd: new Date(Date.now() + 20 * DAY_MS).toISOString(), cancelAtPeriodEnd: false,
  });
  return p;
}

interface RedeemBody { ok: boolean; status?: string; error?: string; months?: number | null; proUntil?: string | null; message?: string }

async function redeem(body: unknown, ip = freshIp()): Promise<{ http: number; body: RedeemBody }> {
  const response = await redeemRoute(new Request('https://api.example.test/api/v1/promo/redeem', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  }));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return { http: response.status, body: await response.json() as RedeemBody };
}

function admin(method: 'GET' | 'POST', body?: unknown, token: string | null = ADMIN_TOKEN): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new Request('https://api.example.test/api/v1/admin/promo', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return method === 'GET' ? adminGet(req) : adminPost(req);
}

async function plan(userId: string): Promise<{ plan: string; status: string; end: number | null }> {
  const { subscription } = await getBillingStore().overview(userId);
  return { plan: subscription.plan, status: subscription.status, end: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).getTime() : null };
}

const near = (a: number | null, b: number, ms = 5_000) => a !== null && Math.abs(a - b) <= ms;

test('401 without an access token, and with one that is not a session; nothing granted', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  const missing = await redeem({ code });
  assert.equal(missing.http, 401);
  assert.equal(missing.body.error, 'unauthorized');
  assert.equal((await redeem({ accessToken: '', code })).http, 401);
  assert.equal((await redeem({ accessToken: 42, code })).http, 401);
  const forged = await redeem({ accessToken: randomUUID(), code });
  assert.equal(forged.http, 401);
  const p = await person('later');
  const ok = await redeem({ accessToken: p.token, code });
  assert.equal(ok.http, 200, 'the code was not used up by the refused calls');
});

test('400 bad_code for anything that is not 16 Crockford characters', async () => {
  resetStores();
  const p = await person('format');
  for (const code of ['', 'hello', '0123-4567-89AB', '0123-4567-89AB-CDEU', 42, null, `${newCode()}X`]) {
    const res = await redeem({ accessToken: p.token, code });
    assert.equal(res.http, 400, String(code));
    assert.equal(res.body.error, 'bad_code');
  }
});

test('redeemed: 200 with months and Pro until now + 90 days; typed variants of the code work', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  const p = await person('first');
  const typed = formatPromoCode(code).toLowerCase().replace(/0/g, 'o').replace(/-/g, ' ');
  const res = await redeem({ accessToken: p.token, code: typed });
  assert.equal(res.http, 200);
  assert.equal(res.body.status, 'redeemed');
  assert.equal(res.body.months, 3);
  assert.ok(near(new Date(res.body.proUntil ?? 0).getTime(), Date.now() + 90 * DAY_MS));
  const now = await plan(p.userId);
  assert.equal(now.plan, 'pro');
  assert.equal(now.status, 'trialing');
  assert.equal(now.end, new Date(res.body.proUntil ?? 0).getTime());
});

test('already_yours: 200 again with the same date and nothing added', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  const p = await person('repeat');
  const first = await redeem({ accessToken: p.token, code });
  const again = await redeem({ accessToken: p.token, code: formatPromoCode(code) });
  assert.equal(again.http, 200);
  assert.equal(again.body.status, 'already_yours');
  assert.equal(again.body.months, 3);
  assert.equal(again.body.proUntil, first.body.proUntil);
  assert.equal((await plan(p.userId)).end, new Date(first.body.proUntil ?? 0).getTime());
});

test('used: 409 when someone else redeemed the code', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  await redeem({ accessToken: (await person('a')).token, code });
  const other = await person('b');
  const res = await redeem({ accessToken: other.token, code });
  assert.equal(res.http, 409);
  assert.equal(res.body.error, 'used');
  assert.equal((await plan(other.userId)).plan, 'free');
});

test('one_per_account: 409 for a second code of the same batch; that code stays usable', async () => {
  resetStores();
  const [first, second] = batch('calhacks13', 2);
  const p = await person('greedy');
  await redeem({ accessToken: p.token, code: first });
  const res = await redeem({ accessToken: p.token, code: second });
  assert.equal(res.http, 409);
  assert.equal(res.body.error, 'one_per_account');
  assert.equal((await redeem({ accessToken: (await person('friend')).token, code: second })).http, 200);
});

test('invalid: 404 for unknown, revoked code and revoked batch, all with the same body', async () => {
  resetStores();
  const [revokedCode] = batch('calhacks13', 1);
  const [batchRevoked] = batch('oldbatch', 1, { revokedAt: new Date().toISOString() });
  const revoke = await admin('POST', { action: 'revoke_code', code: revokedCode });
  assert.equal(revoke.status, 200);
  const p = await person('invalid');
  const unknown = await redeem({ accessToken: p.token, code: newCode() });
  const revoked = await redeem({ accessToken: p.token, code: revokedCode });
  const inRevokedBatch = await redeem({ accessToken: p.token, code: batchRevoked });
  for (const res of [unknown, revoked, inRevokedBatch]) {
    assert.equal(res.http, 404);
    assert.equal(res.body.error, 'invalid');
  }
  assert.deepEqual(revoked.body, unknown.body);
  assert.deepEqual(inRevokedBatch.body, unknown.body);
});

test('expired: 410 after redeem-by', async () => {
  resetStores();
  const [code] = batch('past', 1, { redeemBy: new Date(Date.now() - 60_000).toISOString() });
  const p = await person('late');
  const res = await redeem({ accessToken: p.token, code });
  assert.equal(res.http, 410);
  assert.equal(res.body.error, 'expired');
  assert.equal((await plan(p.userId)).plan, 'free');
});

test('cap_reached: 410 once the batch cap is used', async () => {
  resetStores();
  const codes = batch('small', 3, { cap: 2 });
  assert.equal((await redeem({ accessToken: (await person('a')).token, code: codes[0] })).http, 200);
  assert.equal((await redeem({ accessToken: (await person('b')).token, code: codes[1] })).http, 200);
  const res = await redeem({ accessToken: (await person('c')).token, code: codes[2] });
  assert.equal(res.http, 410);
  assert.equal(res.body.error, 'cap_reached');
});

test('has_paid_plan: 409, the paid plan is untouched and the code stays usable', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  const paid = await payingPerson();
  const before = await plan(paid.userId);
  const res = await redeem({ accessToken: paid.token, code });
  assert.equal(res.http, 409);
  assert.equal(res.body.error, 'has_paid_plan');
  assert.deepEqual(await plan(paid.userId), before);
  assert.equal((await redeem({ accessToken: (await person('next')).token, code })).http, 200);
});

test('stacks on running complimentary Pro', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  const p = await person('stack');
  await new MemoryBillingStore().addProMonths(p.userId, 1);
  const before = (await plan(p.userId)).end ?? 0;
  const res = await redeem({ accessToken: p.token, code });
  assert.equal(new Date(res.body.proUntil ?? 0).getTime(), before + 90 * DAY_MS);
});

test('429 after 20 tries a minute from one address', async () => {
  resetStores();
  const p = await person('spam');
  const ip = freshIp();
  for (let i = 0; i < 20; i += 1) assert.equal((await redeem({ accessToken: p.token, code: newCode() }, ip)).http, 404);
  const limited = await redeem({ accessToken: p.token, code: newCode() }, ip);
  assert.equal(limited.http, 429);
  assert.equal(limited.body.error, 'rate_limited');
});

test('503 on a production build without Supabase (memory is never used in production)', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  const p = await person('prod');
  const saved = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'production' });
  try {
    const res = await redeem({ accessToken: p.token, code });
    assert.equal(res.http, 503);
    assert.equal(res.body.error, 'unavailable');
    assert.equal((await admin('GET')).status, 503);
  } finally {
    if (saved === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV'); else Object.assign(process.env, { NODE_ENV: saved });
  }
});

test('admin: 401 without the token or with a wrong one, for list and revoke', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  assert.equal((await admin('GET', undefined, null)).status, 401);
  assert.equal((await admin('GET', undefined, `${ADMIN_TOKEN}x`)).status, 401);
  assert.equal((await admin('POST', { action: 'revoke_code', code }, null)).status, 401);
  assert.equal((await admin('POST', { action: 'revoke_batch', batchId: 'calhacks13' }, 'wrong-token-0123456789abcdef')).status, 401);
  const p = await person('still-works');
  assert.equal((await redeem({ accessToken: p.token, code })).http, 200, 'refused revokes changed nothing');
});

test('admin list: per-batch counts and redemptions with only an 8-character hash prefix', async () => {
  resetStores();
  const codes = batch('calhacks13', 4, { cap: 300 });
  const a = await person('listed');
  await redeem({ accessToken: a.token, code: codes[0] });
  await admin('POST', { action: 'revoke_code', code: codes[1] });
  const res = await admin('GET');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const text = await res.text();
  for (const code of codes) {
    assert.ok(!text.includes(code), 'no code in the list');
    assert.ok(!text.includes(promoCodeHash(code)), 'no full hash in the list');
  }
  const body = JSON.parse(text) as {
    batches: Array<{ id: string; codes: number; redeemed: number; revoked: number; capLeft: number; redeemBy: string; months: number }>;
    redemptions: Array<{ batchId: string; codeHashPrefix: string; email: string; redeemedAt: string; revokedAt: string | null; proUntil: string }>;
  };
  assert.deepEqual(
    body.batches.map(({ id, codes: n, redeemed, revoked, capLeft, months }) => ({ id, n, redeemed, revoked, capLeft, months })),
    [{ id: 'calhacks13', n: 4, redeemed: 1, revoked: 1, capLeft: 299, months: 3 }],
  );
  assert.ok(body.batches[0].redeemBy);
  assert.equal(body.redemptions.length, 1);
  assert.equal(body.redemptions[0].codeHashPrefix, promoCodeHash(codes[0]).slice(0, 8));
  assert.match(body.redemptions[0].email, /^listed-.*@promo\.test$/);
  assert.equal(body.redemptions[0].revokedAt, null);
  assert.ok(body.redemptions[0].proUntil);
});

test('admin revoke_code: takes the months back, then already_revoked; unknown is 404; bad code 400', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  const p = await person('revoked');
  await redeem({ accessToken: p.token, code });
  const res = await admin('POST', { action: 'revoke_code', code: formatPromoCode(code) });
  assert.equal(res.status, 200);
  const body = await res.json() as { ok: boolean; status: string; monthsTakenBack: boolean };
  assert.deepEqual([body.ok, body.status, body.monthsTakenBack], [true, 'revoked', true]);
  assert.ok(near((await plan(p.userId)).end, Date.now()), 'Pro ends now');
  assert.equal((await redeem({ accessToken: p.token, code })).http, 404, 'even its owner now gets invalid');
  const again = await (await admin('POST', { action: 'revoke_code', code })).json() as { status: string; monthsTakenBack: boolean };
  assert.deepEqual([again.status, again.monthsTakenBack], ['already_revoked', false]);
  assert.equal((await admin('POST', { action: 'revoke_code', code: newCode() })).status, 404);
  assert.equal((await admin('POST', { action: 'revoke_code', code: 'nope' })).status, 400);
  const list = await (await admin('GET')).json() as { batches: Array<{ redeemed: number; capLeft: number }>; redemptions: Array<{ revokedAt: string | null }> };
  assert.equal(list.batches[0].redeemed, 0);
  assert.equal(list.batches[0].capLeft, 300);
  assert.ok(list.redemptions[0].revokedAt);
});

test('admin revoke_code never touches a paid subscription', async () => {
  resetStores();
  const [code] = batch('calhacks13', 1);
  const p = await person('upgraded');
  await redeem({ accessToken: p.token, code });
  const workspace = await getBillingStore().ensurePersonalWorkspace(p.userId);
  await getBillingStore().syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `sub_${randomUUID()}`, stripePriceId: 'price_test_promo',
    currentPeriodEnd: new Date(Date.now() + 25 * DAY_MS).toISOString(), cancelAtPeriodEnd: false,
  });
  const before = await plan(p.userId);
  const body = await (await admin('POST', { action: 'revoke_code', code })).json() as { status: string; monthsTakenBack: boolean };
  assert.deepEqual([body.status, body.monthsTakenBack], ['revoked', false]);
  assert.deepEqual(await plan(p.userId), before);
});

test('admin revoke_batch: every code of the batch answers invalid; repeat and unknown handled', async () => {
  resetStores();
  const [code] = batch('calhacks13', 2);
  const res = await admin('POST', { action: 'revoke_batch', batchId: 'calhacks13' });
  assert.equal(res.status, 200);
  assert.equal((await res.json() as { status: string }).status, 'revoked');
  assert.equal((await redeem({ accessToken: (await person('after')).token, code })).http, 404);
  assert.equal((await (await admin('POST', { action: 'revoke_batch', batchId: 'calhacks13' })).json() as { status: string }).status, 'already_revoked');
  assert.equal((await admin('POST', { action: 'revoke_batch', batchId: 'nosuchbatch' })).status, 404);
  assert.equal((await admin('POST', { action: 'revoke_batch', batchId: 'Bad Id!' })).status, 400);
  assert.equal((await admin('POST', { action: 'create_batch', batchId: 'x' })).status, 400, 'there is no create');
});
