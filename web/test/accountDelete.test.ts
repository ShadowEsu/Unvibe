import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DELETE as deleteAccount } from '../app/api/v1/account/route';
import { getBillingStore } from '../src/billing/store';
import type { SubscriptionSyncInput } from '../src/billing/types';
import { getStore } from '../src/data/store';

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

/** A signed-in user whose personal workspace carries the given subscription state. */
async function userWith(subscription: Partial<SubscriptionSyncInput>): Promise<{ userId: string; token: string }> {
  const account = await getStore().signIn(`delete-${randomUUID()}@account.test`);
  const workspace = await getBillingStore().ensurePersonalWorkspace(account.userId);
  await getBillingStore().syncSubscription({
    workspaceId: workspace.id,
    plan: 'pro',
    interval: 'monthly',
    status: 'active',
    seats: 1,
    stripeCustomerId: 'cus_test_delete',
    stripePriceId: 'price_test_delete',
    stripeSubscriptionId: 'sub_test_delete',
    cancelAtPeriodEnd: false,
    ...subscription,
  });
  return { userId: account.userId, token: account.token };
}

async function remove(token: string): Promise<{ status: number; error?: unknown }> {
  const response = await deleteAccount(new Request('http://localhost/api/v1/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }));
  const body: unknown = await response.json();
  return { status: response.status, error: body !== null && typeof body === 'object' && 'error' in body ? body.error : undefined };
}

test('a subscription already set to cancel at period end does not block account deletion', async () => {
  const me = await userWith({ cancelAtPeriodEnd: true });
  assert.equal((await remove(me.token)).status, 200);
  assert.equal((await remove(me.token)).status, 401, 'the account and its token are gone');
});

test('Pro Lifetime (a one-time payment, nothing renews) does not block account deletion', async () => {
  const me = await userWith({ interval: 'lifetime', stripeSubscriptionId: 'pi_test_lifetime' });
  assert.equal((await remove(me.token)).status, 200);
  assert.equal((await remove(me.token)).status, 401, 'the account and its token are gone');
});

test('a renewing subscription still blocks deletion until it is canceled', async () => {
  const me = await userWith({});
  assert.deepEqual(await remove(me.token), { status: 409, error: 'active_subscription' });
});

test('an unpaid invoice Stripe is still collecting blocks deletion even when set to cancel', async () => {
  const me = await userWith({ status: 'grace_period', cancelAtPeriodEnd: true });
  assert.deepEqual(await remove(me.token), { status: 409, error: 'active_subscription' });
});
