import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { POST as claimRoute } from '../app/api/v1/gifts/claim/route';
import { GET as mineRoute } from '../app/api/v1/gifts/mine/route';
import { GIFT_CODE_LENGTH, giftCodeForEmail, MAX_GIFTS } from '../src/billing/gifts';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { getBillingStore, resetBillingStoreCacheForTests } from '../src/billing/store';
import { getStore, resetStoreCacheForTests } from '../src/data/store';

const SECRET = 'test-gift-secret-0123456789abcdefghijklmnop';
const DAY_MS = 24 * 60 * 60 * 1000;

function resetStores(): void {
  const g = globalThis as unknown as { __uncodeData?: unknown; __uncodeBillingData?: unknown; __unvibeGifts?: unknown };
  g.__uncodeData = undefined;
  g.__uncodeBillingData = undefined;
  g.__unvibeGifts = undefined;
  resetStoreCacheForTests();
  resetBillingStoreCacheForTests();
  process.env.GIFT_CODE_SECRET = SECRET;
}

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

interface Person { userId: string; email: string; token: string }

async function person(label: string): Promise<Person> {
  const account = await getStore().signIn(`${label}-${randomUUID()}@gift.test`);
  await getBillingStore().ensurePersonalWorkspace(account.userId);
  return { userId: account.userId, email: account.email ?? '', token: account.token };
}

function claim(body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': freshIp() };
  if (token) headers.authorization = `Bearer ${token}`;
  return claimRoute(new Request('https://api.example.test/api/v1/gifts/claim', { method: 'POST', headers, body: JSON.stringify(body) }));
}

async function mine(token: string): Promise<Response> {
  return mineRoute(new Request('https://api.example.test/api/v1/gifts/mine', { headers: { authorization: `Bearer ${token}` } }));
}

/** The giver opens the app's Share page, which is the only place a code is issued. */
async function codeOf(giver: Person): Promise<string> {
  const response = await mine(giver.token);
  assert.equal(response.status, 200);
  const body = await response.json() as { code: string; shareUrl: string };
  assert.ok(body.shareUrl.includes(encodeURIComponent(body.code)));
  return body.code;
}

async function plan(userId: string): Promise<{ plan: string; status: string; end: number | null }> {
  const overview = await getBillingStore().overview(userId);
  const end = overview.subscription.currentPeriodEnd;
  return { plan: overview.subscription.plan, status: overview.subscription.status, end: end ? new Date(end).getTime() : null };
}

async function errorOf(response: Response): Promise<string> {
  return (await response.json() as { error: string }).error;
}

test('gift code is an HMAC of the normalized giver email, not a public hash', () => {
  const code = giftCodeForEmail('Preston@Unvibe.site', SECRET);
  assert.equal(code.length, GIFT_CODE_LENGTH);
  assert.ok(GIFT_CODE_LENGTH >= 12);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.equal(code, giftCodeForEmail(' preston@unvibe.site ', SECRET));
  assert.notEqual(code, giftCodeForEmail('preston@unvibe.site', `${SECRET}-other`));
  assert.notEqual(code, giftCodeForEmail('other@unvibe.site', SECRET));
  const sha = createHash('sha256').update('preston@unvibe.site').digest('hex');
  assert.ok(!sha.startsWith(code.slice(0, 8)));
});

test('an unauthenticated claim gets 401 and grants nothing', async () => {
  resetStores();
  const giver = await person('giver');
  const receiver = await person('receiver');
  const code = await codeOf(giver);
  const response = await claim({ code, giverEmail: giver.email, receiverEmail: receiver.email, promoCode: code });
  assert.equal(response.status, 401);
  assert.equal((await plan(giver.userId)).plan, 'free');
  assert.equal((await plan(receiver.userId)).plan, 'free');
});

test('a missing GIFT_CODE_SECRET disables gifts with 503', async () => {
  resetStores();
  const giver = await person('giver');
  const receiver = await person('receiver');
  const code = await codeOf(giver);
  delete process.env.GIFT_CODE_SECRET;
  const claimed = await claim({ code }, receiver.token);
  assert.equal(claimed.status, 503);
  assert.equal(await errorOf(claimed), 'gifts_disabled');
  const issued = await mine(giver.token);
  assert.equal(issued.status, 503);
  assert.equal(await errorOf(issued), 'gifts_disabled');
  process.env.GIFT_CODE_SECRET = 'too-short';
  assert.equal((await claim({ code }, receiver.token)).status, 503);
  assert.equal((await plan(receiver.userId)).plan, 'free');
});

test('a forged sha256 code is refused', async () => {
  resetStores();
  const giver = await person('giver');
  const receiver = await person('receiver');
  await codeOf(giver);
  const forged = createHash('sha256').update(giver.email).digest('hex').slice(0, 8);
  const forged16 = createHash('sha256').update(giver.email).digest('hex').slice(0, GIFT_CODE_LENGTH);
  for (const code of [forged, forged16]) {
    const response = await claim({ code, promoCode: code, giverEmail: giver.email }, receiver.token);
    assert.equal(response.status, 400);
    assert.match(await errorOf(response), /invalid_code|unknown_code/);
  }
  assert.equal((await plan(giver.userId)).plan, 'free');
  assert.equal((await plan(receiver.userId)).plan, 'free');
});

test('a valid HMAC code for an email with no account is refused', async () => {
  resetStores();
  const receiver = await person('receiver');
  const code = giftCodeForEmail('nobody@gift.test', SECRET);
  const response = await claim({ code }, receiver.token);
  assert.equal(response.status, 400);
  assert.equal(await errorOf(response), 'unknown_code');
  assert.equal((await plan(receiver.userId)).plan, 'free');
});

test('the body receiverEmail is ignored and the session user is granted', async () => {
  resetStores();
  const giver = await person('giver');
  const caller = await person('caller');
  const bystander = await person('bystander');
  const code = await codeOf(giver);
  const response = await claim({ code, receiverEmail: bystander.email, recipientEmail: bystander.email }, caller.token);
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { monthAdded: boolean }).monthAdded, true);
  assert.equal((await plan(caller.userId)).plan, 'pro');
  assert.equal((await plan(giver.userId)).plan, 'pro');
  assert.equal((await plan(bystander.userId)).plan, 'free');
});

test('a self-gift is refused', async () => {
  resetStores();
  const giver = await person('giver');
  const code = await codeOf(giver);
  const response = await claim({ code }, giver.token);
  assert.equal(response.status, 400);
  assert.equal(await errorOf(response), 'self_gift');
  assert.equal((await plan(giver.userId)).plan, 'free');
});

test('each account can receive one gift', async () => {
  resetStores();
  const first = await person('giver1');
  const second = await person('giver2');
  const receiver = await person('receiver');
  assert.equal((await claim({ code: await codeOf(first) }, receiver.token)).status, 200);
  const again = await claim({ code: await codeOf(second) }, receiver.token);
  assert.equal(again.status, 409);
  assert.equal(await errorOf(again), 'already_received');
  assert.equal((await claim({ code: await codeOf(first) }, receiver.token)).status, 409);
});

test('a giver gets at most five friends and the months stack', async () => {
  resetStores();
  const giver = await person('giver');
  const code = await codeOf(giver);
  const start = Date.now();
  for (let n = 0; n < MAX_GIFTS; n += 1) {
    const friend = await person(`friend${n}`);
    assert.equal((await claim({ code }, friend.token)).status, 200);
  }
  const late = await person('late');
  const refused = await claim({ code }, late.token);
  assert.equal(refused.status, 409);
  assert.equal(await errorOf(refused), 'giver_full');
  assert.equal((await plan(late.userId)).plan, 'free');
  const giverPlan = await plan(giver.userId);
  assert.equal(giverPlan.plan, 'pro');
  assert.ok(giverPlan.end !== null);
  const days = (giverPlan.end - start) / DAY_MS;
  assert.ok(days > 149 && days < 151, `expected about 150 stacked days, got ${days}`);
  const progress = await (await mine(giver.token)).json() as { used: number; remaining: number; limit: number };
  assert.equal(progress.used, MAX_GIFTS);
  assert.equal(progress.remaining, 0);
  assert.equal(progress.limit, MAX_GIFTS);
});

test('stacked months never go past 12 months ahead', async () => {
  resetStores();
  const giver = await person('giver');
  const receiver = await person('receiver');
  const billing = new MemoryBillingStore();
  assert.equal((await billing.addProMonths(giver.userId, 12)).applied, true);
  const code = await codeOf(giver);
  assert.equal((await claim({ code }, receiver.token)).status, 200);
  const twelveMonths = new Date();
  twelveMonths.setUTCMonth(twelveMonths.getUTCMonth() + 12);
  const giverPlan = await plan(giver.userId);
  assert.equal(giverPlan.plan, 'pro');
  assert.ok(giverPlan.end !== null && giverPlan.end <= twelveMonths.getTime() + 1000);
  assert.ok(giverPlan.end !== null && giverPlan.end >= twelveMonths.getTime() - 60_000);
  assert.equal((await billing.addProMonths(giver.userId, 0)).applied, false);
});

test('a gift never changes an active paid subscription', async () => {
  resetStores();
  const giver = await person('giver');
  const payer = await person('payer');
  const billing = getBillingStore();
  const workspace = await billing.ensurePersonalWorkspace(payer.userId);
  const paidEnd = new Date(Date.now() + 20 * DAY_MS).toISOString();
  await billing.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'annual', status: 'active', seats: 1,
    stripeCustomerId: 'cus_gift', stripeSubscriptionId: 'sub_gift', stripePriceId: 'price_gift',
    currentPeriodEnd: paidEnd, cancelAtPeriodEnd: false,
  });
  const response = await claim({ code: await codeOf(giver) }, payer.token);
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { monthAdded: boolean }).monthAdded, false);
  const after = (await billing.overview(payer.userId)).subscription;
  assert.equal(after.status, 'active');
  assert.equal(after.interval, 'annual');
  assert.equal(after.stripeSubscriptionId, 'sub_gift');
  assert.equal(after.currentPeriodEnd, paidEnd);
  assert.equal((await plan(giver.userId)).plan, 'pro');
});

test('caps hold with more than 1000 gift rows already stored', async () => {
  resetStores();
  const giver = await person('giver');
  const receiver = await person('receiver');
  const code = await codeOf(giver);
  const g = globalThis as unknown as { __unvibeGifts: { redemptions: Array<Record<string, unknown>> } };
  const createdAt = new Date().toISOString();
  for (let n = 0; n < 1500; n += 1) {
    g.__unvibeGifts.redemptions.push({
      id: randomUUID(), giverUserId: null, receiverUserId: null,
      giverEmail: `other${n}@gift.test`, receiverEmail: `someone${n}@gift.test`, code: `filler${n}`, createdAt,
    });
  }
  for (let n = 0; n < MAX_GIFTS - 1; n += 1) {
    g.__unvibeGifts.redemptions.push({
      id: randomUUID(), giverUserId: giver.userId, receiverUserId: null,
      giverEmail: giver.email, receiverEmail: `late${n}@gift.test`, code, createdAt,
    });
  }
  g.__unvibeGifts.redemptions.push({
    id: randomUUID(), giverUserId: null, receiverUserId: null,
    giverEmail: 'old@gift.test', receiverEmail: receiver.email, code: 'filler-old', createdAt,
  });
  const blocked = await claim({ code }, receiver.token);
  assert.equal(blocked.status, 409);
  assert.equal(await errorOf(blocked), 'already_received');
  const fifth = await person('fifth');
  assert.equal((await claim({ code }, fifth.token)).status, 200);
  const sixth = await person('sixth');
  const full = await claim({ code }, sixth.token);
  assert.equal(full.status, 409);
  assert.equal(await errorOf(full), 'giver_full');
  const progress = await (await mine(giver.token)).json() as { used: number };
  assert.equal(progress.used, MAX_GIFTS);
});

test('the gift page needs a signed-in account', async () => {
  resetStores();
  const response = await mineRoute(new Request('https://api.example.test/api/v1/gifts/mine'));
  assert.equal(response.status, 401);
});
