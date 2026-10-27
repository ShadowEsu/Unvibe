import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type Stripe from 'stripe';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { POST as invite } from '../app/api/v1/workspaces/[workspaceId]/invitations/route';
import { getStore } from '../src/data/store';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { BUSINESS_SEATS, BUSINESS_SEATS_FULL } from '../src/billing/plans';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';
import type { BillingStore } from '../src/billing/types';
import { processStripeEvent, type RefundTarget, type StripeWebhookDependencies } from '../src/billing/webhooks';
import { paymentIntent } from './stripeFakes';

// Security BB1: a team workspace whose canceled Teams subscription still carries more than 10 seats
// must never end up paid for Big Business with no grant. Checkout refuses more than 10 people and
// invitations; while a Big Business checkout is open the workspace takes no invitation past 10; and
// a paid grant the seats would still refuse is refunded once and audited, never left as a silent 500.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
delete process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION;
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnlyNeverSent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual';
process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = 'price_enterprise_monthly';
process.env.STRIPE_PRICE_BUSINESS_LIFETIME = 'price_business_lifetime';
process.env.BILLING_NEW_TIERS_ENABLED = 'true';
process.env.AI_PROVIDER = 'bedrock';
process.env.AWS_BEARER_TOKEN_BEDROCK = 'local-bedrock-token';
process.env.BEDROCK_MODEL_ID = 'us.anthropic.claude-haiku-5-5';
process.env.APP_URL = 'http://localhost:3000';

const sessions: Stripe.Checkout.SessionCreateParams[] = [];
const sessionsApi = getStripe().checkout.sessions;
sessionsApi.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
  sessions.push(params);
  const id = `cs_test_${randomUUID()}`;
  return { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', expires_at: params.expires_at };
}) as unknown as typeof sessionsApi.create;

interface Person { userId: string; headers: Record<string, string> }

async function person(): Promise<Person> {
  const account = await getStore().signIn(`seats-${randomUUID()}@team.test`);
  return { userId: account.userId, headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' } };
}

/** A team workspace whose Teams subscription was canceled: it reads as Free but still carries 20 seats. */
async function canceledTeams(store: BillingStore, ownerId: string): Promise<string> {
  const workspace = await store.createTeamWorkspace(ownerId, 'Old team');
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'teams', interval: 'monthly', status: 'canceled', seats: 20,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `sub_${randomUUID()}`, stripePriceId: 'price_teams_monthly',
    currentPeriodStart: new Date().toISOString(), currentPeriodEnd: new Date().toISOString(), cancelAtPeriodEnd: false,
  });
  return workspace.id;
}

/** `count` pending invitations, sent through the store (the SQL seat check: 20 seats on record). */
async function invitations(store: BillingStore, ownerId: string, workspaceId: string, count: number): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  for (let i = 0; i < count; i += 1) await store.createInvitation(ownerId, workspaceId, `pending-${randomUUID()}@team.test`, 'member', randomUUID(), expiresAt);
}

function startBusiness(owner: Person, workspaceId: string): Promise<Response> {
  return checkout(new Request('http://localhost/api/v1/billing/checkout', {
    method: 'POST', headers: owner.headers, body: JSON.stringify({ plan: 'business', interval: 'lifetime', workspaceId }),
  }));
}

function sendInvite(owner: Person, workspaceId: string): Promise<Response> {
  return invite(new Request(`http://localhost/api/v1/workspaces/${workspaceId}/invitations`, {
    method: 'POST', headers: owner.headers, body: JSON.stringify({ email: `late-${randomUUID()}@team.test`, role: 'member' }),
  }), { params: { workspaceId } });
}

test('checkout: 11 people and invitations on the workspace get 409 too_many_seats and no session; 10 open the checkout', async () => {
  const store = getBillingStore();
  for (const [pending, status] of [[BUSINESS_SEATS, 409], [BUSINESS_SEATS - 1, 201]] as const) {
    const owner = await person();
    const workspaceId = await canceledTeams(store, owner.userId);
    await invitations(store, owner.userId, workspaceId, pending);
    sessions.length = 0;
    const response = await startBusiness(owner, workspaceId);
    assert.equal(response.status, status, `owner plus ${pending} invitations`);
    if (status === 409) {
      assert.equal(((await response.json()) as { error: string }).error, 'too_many_seats');
      assert.equal(sessions.length, 0, 'no payable session');
    }
  }
});

test('while a Big Business checkout is open, the workspace takes no invitation past 10, whatever seats an old Teams subscription left', async () => {
  const store = getBillingStore();
  const owner = await person();
  const workspaceId = await canceledTeams(store, owner.userId);
  await invitations(store, owner.userId, workspaceId, BUSINESS_SEATS - 2);
  // No checkout yet: the 20 seats on record still allow invitations.
  assert.equal((await sendInvite(owner, workspaceId)).status, 201, 'the 10th person, before any checkout');
  assert.equal((await startBusiness(owner, workspaceId)).status, 201);
  const refused = await sendInvite(owner, workspaceId);
  assert.equal(refused.status, 409, 'the 11th person during the checkout');
  assert.deepEqual(await refused.json(), { error: 'billing_error', message: BUSINESS_SEATS_FULL });
  const { occupiedSeats, pendingInvitations } = await store.overview(owner.userId, workspaceId);
  assert.equal(occupiedSeats + pendingInvitations, BUSINESS_SEATS);
});

function businessPaid(workspaceId: string, userId: string, pi: string): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'checkout.session.completed', livemode: false, created: 1_797_000_100,
    data: { object: {
      id: `cs_test_${randomUUID()}`, object: 'checkout.session', mode: 'payment', payment_status: 'paid',
      metadata: { workspace_id: workspaceId, user_id: userId, plan: 'business', interval: 'lifetime' },
      line_items: { data: [{ price: { id: 'price_business_lifetime' } }] },
      customer: `cus_${randomUUID()}`, payment_intent: pi,
    } },
  } as unknown as Stripe.Event;
}

test('a paid Big Business grant the seats refuse is refunded in full once (same key on every retry) and audited, never a silent 500', async () => {
  const store = new MemoryBillingStore();
  const audits: Array<{ action: string; metadata: Record<string, unknown> }> = [];
  const record = store.recordAudit.bind(store);
  store.recordAudit = async (userId, workspaceId, action, metadata = {}) => {
    audits.push({ action, metadata });
    return record(userId, workspaceId, action, metadata);
  };
  const ownerId = randomUUID();
  const workspaceId = await canceledTeams(store, ownerId);
  await invitations(store, ownerId, workspaceId, BUSINESS_SEATS);
  const pi = `pi_${randomUUID()}`;
  const refunds: Array<{ target: RefundTarget; key: string }> = [];
  let alreadyRefunded = false;
  const deps: StripeWebhookDependencies = {
    retrieveSubscription: async () => { throw new Error('not used'); },
    retrievePaymentIntent: async (id) => paymentIntent(id),
    refundPayment: async (target, key) => {
      refunds.push({ target, key });
      if (alreadyRefunded) throw Object.assign(new Error('Charge has already been refunded.'), { code: 'charge_already_refunded' });
      return `re_${randomUUID()}`;
    },
  };
  const paid = businessPaid(workspaceId, ownerId, pi);
  await processStripeEvent(store, paid, deps);
  assert.notEqual((await store.overview(ownerId, workspaceId)).subscription.plan, 'business');
  assert.deepEqual(refunds, [{ target: { payment_intent: pi }, key: `uncode-seats-refund-${pi}` }]);
  const refused = audits.filter((audit) => audit.action === 'checkout.refused_seats');
  assert.equal(refused.length, 1);
  assert.equal(refused[0].metadata.paymentIntentId, pi);
  assert.equal(refused[0].metadata.seatsTaken, BUSINESS_SEATS + 1);
  // A retry (Stripe's, or after its idempotency key expired: the charge is already refunded) refunds
  // nothing new, grants nothing and does not fail.
  alreadyRefunded = true;
  await processStripeEvent(store, paid, deps);
  assert.notEqual((await store.overview(ownerId, workspaceId)).subscription.plan, 'business');
  assert.ok(refunds.every((refund) => refund.key === `uncode-seats-refund-${pi}`));
});

test('a paid Big Business grant for exactly 10 people and invitations is granted, with nothing refunded', async () => {
  const store = new MemoryBillingStore();
  const ownerId = randomUUID();
  const workspaceId = await canceledTeams(store, ownerId);
  await invitations(store, ownerId, workspaceId, BUSINESS_SEATS - 1);
  const refunds: string[] = [];
  const deps: StripeWebhookDependencies = {
    retrieveSubscription: async () => { throw new Error('not used'); },
    retrievePaymentIntent: async (id) => paymentIntent(id),
    refundPayment: async (_target, key) => { refunds.push(key); return 're_unexpected'; },
  };
  await processStripeEvent(store, businessPaid(workspaceId, ownerId, `pi_${randomUUID()}`), deps);
  const overview = await store.overview(ownerId, workspaceId);
  assert.equal(overview.subscription.plan, 'business');
  assert.equal(overview.subscription.seats, BUSINESS_SEATS);
  assert.deepEqual(refunds, []);
});
