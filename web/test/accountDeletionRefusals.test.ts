import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DELETE as deleteAccount } from '../app/api/v1/account/route';
import { POST as postToken } from '../app/api/v1/auth/token/route';
import { POST as postEvents } from '../app/api/v1/events/route';
import { GET as giftsMine } from '../app/api/v1/gifts/mine/route';
import { GET as getHistory } from '../app/api/v1/history/route';
import { POST as redeemRoute } from '../app/api/v1/promo/redeem/route';
import { POST as postReview } from '../app/api/v1/reviews/route';
import { GET as getWorkspaces, POST as createWorkspace } from '../app/api/v1/workspaces/route';
import { getBillingStore } from '../src/billing/store';
import { seedMemoryPromoBatch } from '../src/billing/promo';
import { getStore } from '../src/data/store';
import { accountDeletionServices } from '../src/lib/accountDeletionServices';
import { PROMO_ALPHABET, promoCodeHash } from '../src/lib/promoCode';

// While a deletion is started (or after it is done), a session that survives cannot write to the
// account or re-create it. Memory stores; the SQL triggers that back this up are in the sqltest.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

let authDown = false;
accountDeletionServices().auth = {
  async deleteUser() {
    if (authDown) throw new Error('Supabase Auth delete failed: 503 no status');
    return 'not_found';
  },
};
accountDeletionServices().betaDownloads = { deleteForEmail: async () => 'deleted' };

const store = getStore();

function call(handler: (req: Request) => Promise<Response>, path: string, token: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
  return handler(new Request(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-forwarded-for': `10.4.0.${randomInt(250)}` },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  }));
}

/** A person whose deletion started and then stopped at the Auth step (state started, session alive). */
async function personMidDeletion() {
  const me = await store.signIn(`midway-${randomUUID()}@account.test`);
  await store.upsertEvents(me.userId, [{ id: randomUUID(), ts: new Date().toISOString(), scope: 'selection', level: 'beginner', outcome: 'understood' }]);
  authDown = true;
  const stopped = await call(deleteAccount, '/api/v1/account', me.token, { method: 'DELETE' });
  authDown = false;
  assert.equal(stopped.status, 503);
  assert.equal((await store.accountDeletion(me.userId))?.state, 'started');
  return me;
}

test('during a deletion, writes with a surviving session answer 410 and create nothing', async () => {
  const me = await personMidDeletion();
  const event = { id: randomUUID(), ts: new Date().toISOString(), scope: 'selection', level: 'beginner', outcome: 'understood' };
  assert.equal((await call(postEvents, '/api/v1/events', me.token, { method: 'POST', body: { events: [event] } })).status, 410);
  assert.equal((await store.history(me.userId, 10)).length, 1, 'the event was not stored');
  assert.equal((await call(getWorkspaces, '/api/v1/workspaces', me.token)).status, 410);
  assert.equal((await call(createWorkspace, '/api/v1/workspaces', me.token, { method: 'POST', body: { name: 'New team' } })).status, 410);
  assert.deepEqual(await getBillingStore().existingWorkspaces(me.userId), [], 'no workspace was provisioned');
  assert.equal((await call(giftsMine, '/api/v1/gifts/mine', me.token)).status, 410);
  const review = await call(postReview, '/api/v1/reviews', me.token, { method: 'POST', body: { scope: 'selection', level: 'beginner', context: { code: 'x = 1' } } });
  assert.equal(review.status, 410);
  assert.equal((await call(getHistory, '/api/v1/history', me.token)).status, 401, 'reads see no session');
  // The deletion still finishes with the same token.
  assert.deepEqual(await (await call(deleteAccount, '/api/v1/account', me.token, { method: 'DELETE' })).json(), { ok: true, status: 'deleted' });
});

test('during a deletion, /redeem refuses (410) before it upserts the user, and the code stays unused', async () => {
  const me = await personMidDeletion();
  const code = Array.from({ length: 16 }, () => PROMO_ALPHABET[randomInt(32)]).join('');
  seedMemoryPromoBatch({ id: `deletion-${randomUUID()}`, months: 1, maxRedemptions: 10, redeemBy: new Date(Date.now() + 86_400_000).toISOString() }, [promoCodeHash(code)]);
  const refused = await call(redeemRoute, '/api/v1/promo/redeem', me.token, { method: 'POST', body: { accessToken: me.token, code } });
  assert.equal(refused.status, 410);
  assert.equal((await refused.json() as { error?: string }).error, 'account_deleted');
  const other = await store.signIn(`other-${randomUUID()}@account.test`);
  const redeemed = await call(redeemRoute, '/api/v1/promo/redeem', other.token, { method: 'POST', body: { accessToken: other.token, code } });
  assert.equal((await redeemed.json() as { status?: string }).status, 'redeemed', 'the refused attempt did not use the code');
});

test('during a deletion, approving a device code or signing in again is refused', async () => {
  const me = await personMidDeletion();
  const device = await store.createDeviceCode('http://localhost');
  await assert.rejects(store.approveDeviceCode(device.userCode, me.userId, me.email), /account_deleted/);
  assert.equal(await store.redeemDeviceCode(device.deviceCode), 'pending', 'no session was minted');
  await assert.rejects(store.signIn(me.email), /account_deleted/);
});

test('after deletion, a device code approved earlier but not yet redeemed no longer yields a session', async () => {
  const me = await store.signIn(`refresh-${randomUUID()}@account.test`);
  const device = await store.createDeviceCode('http://localhost');
  assert.ok(await store.approveDeviceCode(device.userCode, me.userId, me.email));
  assert.equal((await call(deleteAccount, '/api/v1/account', me.token, { method: 'DELETE' })).status, 200);
  const redeemed = await postToken(new Request('http://localhost/api/v1/auth/token', { method: 'POST', body: JSON.stringify({ deviceCode: device.deviceCode }) }));
  assert.equal(redeemed.status, 404);
  assert.equal(await store.userForToken(me.token), null);
});
