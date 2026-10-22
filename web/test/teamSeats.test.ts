import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type Stripe from 'stripe';
import { PATCH as changeSeats } from '../app/api/v1/billing/seats/route';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';

// Real route + memory stores. Test-mode key; the Stripe client's subscription methods are replaced
// on the cached client, so no request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';

const subscriptionId = `sub_${randomUUID()}`;
let stripeSeats = 3;
const keys: string[] = [];
const replies = new Map<string, number>();
const subscriptionsApi = getStripe().subscriptions;
subscriptionsApi.retrieve = (async (id: string) => {
  assert.equal(id, subscriptionId);
  return { id, items: { data: [{ id: 'si_seats', quantity: stripeSeats }] } };
}) as unknown as typeof subscriptionsApi.retrieve;
subscriptionsApi.update = (async (id: string, params: Stripe.SubscriptionUpdateParams, options?: Stripe.RequestOptions) => {
  const key = options?.idempotencyKey;
  assert.ok(key, 'seat changes carry an idempotency key');
  keys.push(key);
  // Like Stripe: a reused key replays the first result for 24 hours and applies nothing.
  const replayed = replies.get(key);
  if (replayed === undefined) {
    stripeSeats = params.items?.[0]?.quantity ?? stripeSeats;
    replies.set(key, stripeSeats);
  }
  return { id, items: { data: [{ id: 'si_seats', quantity: replayed ?? stripeSeats }] } };
}) as unknown as typeof subscriptionsApi.update;

test('each seat change reaches Stripe, even 3 -> 4 -> 3 -> 4 within a day; an identical retry changes nothing', async () => {
  const account = await getStore().signIn(`seats-${randomUUID()}@seats.test`);
  const billing = getBillingStore();
  const team = await billing.createTeamWorkspace(account.userId, 'Seat changes');
  await billing.syncSubscription({
    workspaceId: team.id, plan: 'teams', interval: 'monthly', status: 'active', seats: 3,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: subscriptionId, stripePriceId: 'price_teams_monthly', cancelAtPeriodEnd: false,
  });
  const patch = (seats: number) => changeSeats(new Request('http://localhost/api/v1/billing/seats', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId: team.id, seats }),
  }));

  for (const seats of [4, 3, 4]) assert.equal((await patch(seats)).status, 200);
  assert.equal(new Set(keys).size, 3, `three changes need three idempotency keys, got ${JSON.stringify(keys)}`);
  assert.equal(stripeSeats, 4, 'Stripe bills the last requested seat count');
  assert.equal((await billing.overview(account.userId, team.id)).subscription.seats, 4);

  // The client retries the last request (say its response was lost): Stripe already has 4 seats.
  assert.equal((await patch(4)).status, 200);
  assert.equal(keys.length, 3, 'a retried identical request sends no second update');
  assert.equal(stripeSeats, 4);
});
