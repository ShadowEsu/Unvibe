import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type Stripe from 'stripe';
import { DELETE as deleteAccount, GET as accountInfo } from '../app/api/v1/account/route';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';
import type { SubscriptionSyncInput } from '../src/billing/types';
import { getStore } from '../src/data/store';

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';

const PERIOD_END = 1_800_000_000;

/** Live Stripe subscriptions by id; the cached client's retrieve is replaced so nothing leaves the machine. */
const live = new Map<string, Stripe.Subscription | Error>();
const retrieved: string[] = [];
const subscriptionsApi = getStripe().subscriptions;
subscriptionsApi.retrieve = (async (id: string) => {
  retrieved.push(id);
  const found = live.get(id);
  if (!found) throw new Error(`unknown subscription ${id}`);
  if (found instanceof Error) throw found;
  return found;
}) as unknown as typeof subscriptionsApi.retrieve;

function liveSubscription(id: string, fields: Partial<Pick<Stripe.Subscription, 'status' | 'cancel_at_period_end' | 'cancel_at'>> = {}): Stripe.Subscription {
  return {
    id, status: 'active', cancel_at_period_end: false, cancel_at: null,
    items: { data: [{ current_period_end: PERIOD_END }] },
    ...fields,
  } as unknown as Stripe.Subscription;
}

/** A signed-in user whose personal workspace's stored row says `db`, and whose Stripe subscription is `stripe`. */
async function userWith(db: Partial<SubscriptionSyncInput>, stripe?: Partial<Pick<Stripe.Subscription, 'status' | 'cancel_at_period_end' | 'cancel_at'>> | Error) {
  const account = await getStore().signIn(`delete-${randomUUID()}@account.test`);
  const workspace = await getBillingStore().ensurePersonalWorkspace(account.userId);
  const stripeSubscriptionId = db.stripeSubscriptionId ?? `sub_${randomUUID()}`;
  await getBillingStore().syncSubscription({
    workspaceId: workspace.id,
    plan: 'pro',
    interval: 'monthly',
    status: 'active',
    seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`,
    stripePriceId: 'price_test_delete',
    cancelAtPeriodEnd: false,
    ...db,
    stripeSubscriptionId,
  });
  if (stripe) live.set(stripeSubscriptionId, stripe instanceof Error ? stripe : liveSubscription(stripeSubscriptionId, stripe));
  return { userId: account.userId, token: account.token, stripeSubscriptionId };
}

async function remove(token: string): Promise<{ status: number; error?: unknown }> {
  const response = await deleteAccount(new Request('http://localhost/api/v1/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }));
  const body: unknown = await response.json();
  return { status: response.status, error: body !== null && typeof body === 'object' && 'error' in body ? body.error : undefined };
}

async function stillSignedIn(token: string): Promise<boolean> {
  const response = await accountInfo(new Request('http://localhost/api/v1/account', { headers: { authorization: `Bearer ${token}` } }));
  return response.status === 200;
}

test('a subscription set to cancel at period end does not block account deletion', async () => {
  const me = await userWith({ cancelAtPeriodEnd: true }, { cancel_at_period_end: true });
  assert.equal((await remove(me.token)).status, 200);
  assert.equal(await stillSignedIn(me.token), false, 'the account and its token are gone');
});

test('Pro Lifetime (a one-time payment, nothing renews) deletes without asking Stripe', async () => {
  const me = await userWith({ interval: 'lifetime', stripeSubscriptionId: `pi_${randomUUID()}` });
  assert.equal((await remove(me.token)).status, 200);
  assert.equal(retrieved.includes(me.stripeSubscriptionId), false);
});

test('a renewing subscription blocks deletion', async () => {
  const me = await userWith({}, {});
  assert.deepEqual(await remove(me.token), { status: 409, error: 'active_subscription' });
});

test('an unpaid invoice Stripe is still collecting blocks deletion even when set to cancel', async () => {
  const me = await userWith({ status: 'grace_period', cancelAtPeriodEnd: true }, { status: 'past_due', cancel_at_period_end: true });
  assert.deepEqual(await remove(me.token), { status: 409, error: 'active_subscription' });
});

test('"Don\'t cancel" in the portal blocks deletion before its webhook lands', async () => {
  // The stored row still says cancel at period end; Stripe already renews again.
  const me = await userWith({ cancelAtPeriodEnd: true }, { cancel_at_period_end: false });
  assert.deepEqual(await remove(me.token), { status: 409, error: 'active_subscription' });
  assert.equal(await stillSignedIn(me.token), true);
});

test('a portal cancel (cancel_at at period end) allows deletion before its webhook lands', async () => {
  const me = await userWith({ cancelAtPeriodEnd: false }, { cancel_at: PERIOD_END });
  assert.equal((await remove(me.token)).status, 200);
});

test('a cancel_at after the current period still renews once more and blocks deletion', async () => {
  const me = await userWith({ cancelAtPeriodEnd: false }, { cancel_at: PERIOD_END + 30 * 86_400 });
  assert.deepEqual(await remove(me.token), { status: 409, error: 'active_subscription' });
});

test('if Stripe cannot be reached, nothing is deleted', async () => {
  const me = await userWith({ cancelAtPeriodEnd: true }, new Error('Stripe is down'));
  assert.deepEqual(await remove(me.token), { status: 503, error: 'billing_unavailable' });
  assert.equal(await stillSignedIn(me.token), true);
});
