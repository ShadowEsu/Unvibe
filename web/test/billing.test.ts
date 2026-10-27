import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { format } from 'node:util';
import Stripe from 'stripe';
import { billingError, errorSummary } from '../src/billing/http';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import {
  canManageBilling,
  canManageMembers,
  effectivePlan,
  minimumSeatsForUsage,
  normalizedSeats,
  planLimit,
  priceFor,
  proAnnualSavingsPercent,
  teamsAnnualSavingsPercent,
  teamsCheckoutEnabled,
} from '../src/billing/plans';
import { processStripeEvent, syncStripeSubscription, type StripeWebhookDependencies } from '../src/billing/webhooks';
import { publicBillingOverview } from '../src/billing/presentation';
import { stripePriceId } from '../src/billing/stripe';
import { goodPayments } from './stripeFakes';

/** These syncs never replace another subscription, and no invoice was paid yet, so only the grant check's list call answers. */
const noStripe: StripeWebhookDependencies = { retrieveSubscription: async () => { throw new Error('unexpected Stripe call'); }, latestPaidInvoicePayments: goodPayments.latestPaidInvoicePayments };

test('pricing math matches every published total', () => {
  assert.equal(priceFor('free', 'monthly', 1), 0);
  assert.equal(priceFor('pro', 'monthly', 1), 900);
  assert.equal(priceFor('pro', 'annual', 1), 8_100);
  assert.equal(priceFor('pro', 'lifetime', 1), 8_000);
  assert.equal(priceFor('teams', 'monthly', 2), 1_600);
  assert.equal(priceFor('teams', 'monthly', 5), 4_000);
  assert.equal(priceFor('teams', 'annual', 2), 14_400);
  assert.equal(priceFor('teams', 'annual', 5), 36_000);
  assert.equal(priceFor('teams', 'monthly', 20), 16_000);
  assert.equal(priceFor('teams', 'monthly', 500), 16_000);
  assert.equal(priceFor('enterprise', 'monthly', 1), 5_000);
  assert.equal(priceFor('enterprise', 'monthly', 9), 5_000, 'Enterprise is one account');
  assert.equal(priceFor('business', 'lifetime', 1), 500_000);
  assert.throws(() => priceFor('enterprise', 'annual', 1));
  assert.throws(() => priceFor('business', 'monthly', 1));
  assert.throws(() => priceFor('teams', 'lifetime', 2));
  assert.equal(proAnnualSavingsPercent(), 25);
  assert.equal(teamsAnnualSavingsPercent(), 25);
});

test('Teams checkout opens only when both Teams prices are configured', () => {
  assert.equal(teamsCheckoutEnabled({}), false);
  assert.equal(teamsCheckoutEnabled({ STRIPE_PRICE_TEAMS_MONTHLY: 'price_m' }), false);
  assert.equal(teamsCheckoutEnabled({ STRIPE_PRICE_TEAMS_MONTHLY: 'price_m', STRIPE_PRICE_TEAMS_ANNUAL: 'price_a' }), true);
});

test('Teams clamps abusive seat quantities while Pro stays one-person', () => {
  assert.equal(normalizedSeats('teams', 1), 2);
  assert.equal(normalizedSeats('teams', 2.5), 2);
  assert.equal(normalizedSeats('teams', 2), 2);
  assert.equal(normalizedSeats('teams', 500), 20);
  assert.equal(normalizedSeats('pro', 300), 1);
  assert.equal(normalizedSeats('enterprise', 300), 1);
  assert.equal(normalizedSeats('business', 300), 1);
  assert.equal(minimumSeatsForUsage(3, 2), 5);
});

test('Pro, Enterprise, Big Business and Teams entitlements use configured allowance scaling', () => {
  assert.equal(planLimit('pro', 'ai_explanation', 1), 200);
  assert.equal(planLimit('pro', 'indexed_project', 1), 10);
  assert.equal(planLimit('teams', 'ai_explanation', 2), 200);
  assert.equal(planLimit('teams', 'project_question', 5), 2_500);
  assert.equal(planLimit('teams', 'indexed_project', 5), 10);
  assert.deepEqual(
    (['ai_explanation', 'project_question', 'indexed_project', 'dictionary_item', 'saved_item'] as const).map((kind) => planLimit('enterprise', kind, 7)),
    [1_000, 2_500, 25, 5_000, 5_000],
    'Enterprise caps, never scaled by seats',
  );
  assert.deepEqual(
    (['ai_explanation', 'project_question', 'indexed_project', 'dictionary_item', 'saved_item'] as const).map((kind) => planLimit('business', kind, 7)),
    [5_000, 10_000, 100, 20_000, 20_000],
    'Big Business written fair-use caps, never scaled by seats',
  );
});

test('server selects trusted price IDs for every paid interval', () => {
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pm';
  process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pa';
  process.env.STRIPE_PRICE_TEAMS_MONTHLY = 'price_tm';
  process.env.STRIPE_PRICE_TEAMS_ANNUAL = 'price_ta';
  assert.equal(stripePriceId('pro', 'monthly'), 'price_pm');
  assert.equal(stripePriceId('pro', 'annual'), 'price_pa');
  assert.equal(stripePriceId('teams', 'monthly'), 'price_tm');
  assert.equal(stripePriceId('teams', 'annual'), 'price_ta');
  process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = 'price_em';
  process.env.STRIPE_PRICE_BUSINESS_LIFETIME = 'price_bl';
  process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL = 'price_never_sold';
  assert.equal(stripePriceId('enterprise', 'monthly'), 'price_em');
  assert.equal(stripePriceId('business', 'lifetime'), 'price_bl');
  assert.throws(() => stripePriceId('enterprise', 'annual'), /no annual price/, 'a plan never sold on an interval has no price, whatever the env holds');
  assert.throws(() => stripePriceId('business', 'monthly'));
  assert.throws(() => stripePriceId('teams', 'lifetime'));
  delete process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
  delete process.env.STRIPE_PRICE_BUSINESS_LIFETIME;
  delete process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL;
});

test('roles separate billing and member authority', () => {
  assert.equal(canManageBilling('owner'), true);
  assert.equal(canManageBilling('admin'), false);
  assert.equal(canManageMembers('owner'), true);
  assert.equal(canManageMembers('admin'), true);
  assert.equal(canManageMembers('member'), false);
});

test('inactive, canceled, unpaid, and expired grace subscriptions fall back to Free', () => {
  assert.equal(effectivePlan('pro', 'active'), 'pro');
  assert.equal(effectivePlan('teams', 'past_due'), 'free');
  assert.equal(effectivePlan('pro', 'canceled'), 'free');
  assert.equal(effectivePlan('pro', 'unpaid'), 'free');
  assert.equal(effectivePlan('pro', 'grace_period', '2020-01-01T00:00:00.000Z'), 'free');
  assert.equal(effectivePlan('pro', 'trialing', undefined, new Date('2026-08-26T00:00:00.000Z'), '2026-07-01T00:00:00.000Z'), 'free');
  assert.equal(effectivePlan('pro', 'trialing', undefined, new Date('2026-08-26T00:00:00.000Z'), '2026-09-01T00:00:00.000Z'), 'pro');
});

test('existing users receive one stable Free workspace and 50 monthly explanations', async () => {
  const userId = randomUUID();
  const store = new MemoryBillingStore(() => new Date('2026-07-16T12:00:00.000Z'));
  const first = await store.ensurePersonalWorkspace(userId);
  const second = await store.ensurePersonalWorkspace(userId);
  assert.equal(first.id, second.id);
  const overview = await store.overview(userId);
  assert.equal(overview.subscription.plan, 'free');
  for (let index = 0; index < 50; index += 1) assert.equal((await store.reserveUsage(userId, 'ai_explanation')).allowed, true);
  const denied = await store.reserveUsage(userId, 'ai_explanation');
  assert.equal(denied.allowed, false);
  assert.equal(denied.line.used, 50);
  assert.equal(denied.line.remaining, 0);
});

test('pending invitations reserve paid seats and owners cannot reduce below occupancy', async () => {
  const owner = randomUUID();
  const member = randomUUID();
  const store = new MemoryBillingStore(() => new Date('2026-07-16T12:00:00.000Z'));
  const workspace = await store.createTeamWorkspace(owner, 'Engineers');
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'teams', interval: 'monthly', status: 'active', seats: 2,
    stripeCustomerId: 'cus_test', stripeSubscriptionId: 'sub_test', stripePriceId: 'price_team', cancelAtPeriodEnd: false,
  });
  await store.createInvitation(owner, workspace.id, 'member@example.com', 'member', 'hash-one', '2026-07-23T12:00:00.000Z');
  await assert.rejects(store.createInvitation(owner, workspace.id, 'second@example.com', 'member', 'hash-two', '2026-07-23T12:00:00.000Z'), /paid seat/i);
  await assert.rejects(store.acceptInvitation(member, 'hash-one', 'wrong@example.com'), /invited email/i);
  await store.acceptInvitation(member, 'hash-one', 'member@example.com');
  await assert.rejects(store.changeSeatQuantity(owner, workspace.id, 1), /at least 2 seats/i);
  assert.equal((await store.overview(owner, workspace.id)).occupiedSeats, 2);
});

test('webhook claims are idempotent but failed processing can retry', async () => {
  const store = new MemoryBillingStore();
  const eventId = `evt_${randomUUID()}`;
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'claimed');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'in_progress');
  await store.failWebhook(eventId, 'temporary database error');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'claimed');
  await store.completeWebhook(eventId);
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'completed');
});

test('public plan payloads never expose provider identifiers', async () => {
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: 'cus_private', stripeSubscriptionId: 'sub_private', stripePriceId: 'price_private', cancelAtPeriodEnd: false,
  });
  const payload = JSON.stringify(publicBillingOverview(await store.overview(userId)));
  assert.equal(payload.includes('cus_private'), false);
  assert.equal(payload.includes('sub_private'), false);
  assert.equal(payload.includes('price_private'), false);
  assert.equal(JSON.parse(payload).hasBillingAccount, true);
});

test('a checkout intent stays open until its Stripe session can no longer be paid, then expires', async () => {
  let now = new Date('2026-07-16T12:00:00.000Z');
  const store = new MemoryBillingStore(() => now);
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const intent = await store.createCheckoutIntent({ userId, workspaceId: workspace.id, plan: 'pro', interval: 'monthly', seats: 1 });
  assert.equal((await store.pendingCheckout(userId, workspace.id))?.id, intent.id);
  // The session itself expires at 12:31 (CHECKOUT_SESSION_TTL_MS); the intent outlives it.
  now = new Date('2026-07-16T12:31:59.000Z');
  assert.equal((await store.pendingCheckout(userId, workspace.id))?.id, intent.id);
  now = new Date('2026-07-16T12:32:00.000Z');
  assert.equal(await store.pendingCheckout(userId, workspace.id), null);
});

test('paid activation, cancellation, and downgrade preserve recorded usage', async () => {
  const userId = randomUUID();
  const store = new MemoryBillingStore(() => new Date('2026-07-16T12:00:00.000Z'));
  const workspace = await store.ensurePersonalWorkspace(userId);
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'annual', status: 'active', seats: 1,
    stripeCustomerId: 'cus_lifecycle', stripeSubscriptionId: 'sub_lifecycle', stripePriceId: 'price_lifecycle', cancelAtPeriodEnd: false,
  });
  assert.equal((await store.overview(userId)).subscription.plan, 'pro');
  await store.reserveUsage(userId, 'ai_explanation');
  await store.markSubscriptionCanceled('sub_lifecycle');
  const downgraded = await store.overview(userId);
  assert.equal(downgraded.subscription.plan, 'free');
  assert.equal(downgraded.usage.find((line) => line.kind === 'ai_explanation')?.used, 1);
});

test('failed Stripe payments enter a bounded grace period', async () => {
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_grace';
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const subscription = {
    id: 'sub_grace', status: 'past_due', customer: 'cus_grace', cancel_at_period_end: false,
    metadata: { workspace_id: workspace.id, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_grace' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
  await syncStripeSubscription(store, subscription, noStripe);
  const overview = await store.overview(userId);
  assert.equal(overview.subscription.status, 'grace_period');
  assert.ok(overview.subscription.gracePeriodEndsAt);
  assert.equal(overview.subscription.plan, 'pro');
});

test('personal and team workspaces stay separate and reject unauthorized access', async () => {
  const owner = randomUUID();
  const outsider = randomUUID();
  const store = new MemoryBillingStore();
  const personal = await store.ensurePersonalWorkspace(owner);
  const team = await store.createTeamWorkspace(owner, 'Separate team');
  const workspaces = await store.listWorkspaces(owner);
  assert.deepEqual(new Set(workspaces.map((workspace) => workspace.id)), new Set([personal.id, team.id]));
  assert.equal(await store.getWorkspaceAccess(outsider, team.id), null);
  await assert.rejects(store.overview(outsider, team.id), /access denied/i);
});

test('Stripe subscription sync validates trusted price and quantities', async () => {
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const subscription = {
    id: 'sub_verified', status: 'active', customer: 'cus_verified', cancel_at_period_end: false,
    metadata: { workspace_id: workspace.id, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
  await syncStripeSubscription(store, subscription, noStripe);
  assert.equal((await store.overview(workspace.ownerUserId)).subscription.plan, 'pro');

  const tampered = { ...subscription, id: 'sub_bad', items: { data: [{ quantity: 2, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] } } as unknown as Stripe.Subscription;
  await assert.rejects(syncStripeSubscription(store, tampered, noStripe), /exactly one/i);
});

test('a live subscription event for a workspace with Pro Lifetime leaves Lifetime in place and is audited', async () => {
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  // How grantLifetimeFromCheckout stores it: the one-time payment id stands in for a subscription id.
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'lifetime', status: 'active', seats: 1,
    stripeCustomerId: 'cus_lifetime_kept', stripeSubscriptionId: 'pi_lifetime_kept', stripePriceId: 'price_pro_lifetime', cancelAtPeriodEnd: false,
  });
  const audits: string[] = [];
  store.recordAudit = async (_userId, _workspaceId, action, metadata = {}) => { audits.push(`${action} ${String(metadata.stripeSubscriptionId)}`); };
  const subscription = {
    id: 'sub_over_lifetime', status: 'active', customer: 'cus_lifetime_kept', cancel_at_period_end: false, created: 1_797_000_000,
    metadata: { workspace_id: workspace.id, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
  await syncStripeSubscription(store, subscription, noStripe);
  const overview = await store.overview(workspace.ownerUserId);
  assert.equal(overview.subscription.interval, 'lifetime');
  assert.equal(overview.subscription.status, 'active');
  assert.deepEqual(audits, ['subscription.ignored_lifetime sub_over_lifetime']);
});

test('a cancel scheduled with cancel_at (how the Stripe portal cancels on dahlia) counts as ending at period end', async () => {
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const periodEnd = 1_800_000_000;
  const base = {
    status: 'active', customer: 'cus_cancel_at', cancel_at_period_end: false,
    metadata: { workspace_id: workspace.id, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: periodEnd }] },
  };
  const cancelAtOf = async () => (await store.overview(workspace.ownerUserId)).subscription.cancelAtPeriodEnd;

  // Portal cancel: cancel_at is the period end and cancel_at_period_end stays false.
  await syncStripeSubscription(store, { ...base, id: 'sub_cancel_at', cancel_at: periodEnd } as unknown as Stripe.Subscription, noStripe);
  assert.equal(await cancelAtOf(), true);

  // A cancel date inside the current period also means no further renewal.
  await syncStripeSubscription(store, { ...base, id: 'sub_cancel_at', cancel_at: periodEnd - 86_400 } as unknown as Stripe.Subscription, noStripe);
  assert.equal(await cancelAtOf(), true);

  // A cancel date after this period still renews (and charges) at least once more.
  await syncStripeSubscription(store, { ...base, id: 'sub_cancel_at', cancel_at: periodEnd + 30 * 86_400 } as unknown as Stripe.Subscription, noStripe);
  assert.equal(await cancelAtOf(), false);

  // "Don't cancel" in the portal clears cancel_at.
  await syncStripeSubscription(store, { ...base, id: 'sub_cancel_at', cancel_at: null } as unknown as Stripe.Subscription, noStripe);
  assert.equal(await cancelAtOf(), false);

  // The legacy flag still works.
  await syncStripeSubscription(store, { ...base, id: 'sub_cancel_at', cancel_at: null, cancel_at_period_end: true } as unknown as Stripe.Subscription, noStripe);
  assert.equal(await cancelAtOf(), true);
});

test('lifetime checkout grants permanent Pro', async () => {
  process.env.STRIPE_PRICE_PRO_LIFETIME = 'price_pro_lifetime';
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const intent = await store.createCheckoutIntent({
    userId, workspaceId: workspace.id, plan: 'pro', interval: 'lifetime', seats: 1,
  });
  const session = {
    id: 'cs_lifetime',
    mode: 'payment',
    payment_status: 'paid',
    customer: 'cus_lifetime',
    payment_intent: 'pi_lifetime',
    metadata: { workspace_id: workspace.id, user_id: userId, plan: 'pro', interval: 'lifetime', checkout_intent_id: intent.id },
    line_items: { data: [{ price: { id: 'price_pro_lifetime' } }] },
  } as unknown as Stripe.Checkout.Session;
  await processStripeEvent(store, {
    id: 'evt_lifetime',
    type: 'checkout.session.completed',
    data: { object: session },
  } as Stripe.Event, {
    retrieveSubscription: async () => { throw new Error('subscription should not be retrieved for lifetime'); },
    retrieveCheckoutSession: async () => session,
    retrievePaymentIntent: goodPayments.retrievePaymentIntent,
  });
  const overview = await store.overview(userId);
  assert.equal(overview.subscription.plan, 'pro');
  assert.equal(overview.subscription.interval, 'lifetime');
  assert.equal(overview.subscription.status, 'active');
  assert.equal(overview.subscription.currentPeriodEnd?.startsWith('2099'), true);
  assert.equal((await store.findCheckoutIntent('cs_lifetime'))?.status, 'completed');
});

test('a paid Lifetime session whose line items carry no price grants nothing', async () => {
  process.env.STRIPE_PRICE_PRO_LIFETIME = 'price_pro_lifetime';
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const session = {
    id: `cs_${randomUUID()}`, mode: 'payment', payment_status: 'paid', customer: 'cus_no_price', payment_intent: `pi_${randomUUID()}`,
    metadata: { workspace_id: workspace.id, user_id: userId, plan: 'pro', interval: 'lifetime' },
  } as unknown as Stripe.Checkout.Session;
  const deps = {
    retrieveSubscription: async (): Promise<Stripe.Subscription> => { throw new Error('unexpected subscription'); },
    retrieveCheckoutSession: async () => session,
  };
  await assert.rejects(
    processStripeEvent(store, { id: `evt_${randomUUID()}`, type: 'checkout.session.completed', data: { object: session } } as Stripe.Event, deps),
    /lifetime price/i,
  );
  assert.equal((await store.overview(userId)).subscription.plan, 'free');
});

test('lifetime checkout does not grant Pro until an asynchronous payment succeeds', async () => {
  process.env.STRIPE_PRICE_PRO_LIFETIME = 'price_pro_lifetime';
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const intent = await store.createCheckoutIntent({ userId, workspaceId: workspace.id, plan: 'pro', interval: 'lifetime', seats: 1 });
  await store.attachCheckoutSession(intent.id, 'cs_delayed');
  const session = {
    id: 'cs_delayed', mode: 'payment', payment_status: 'unpaid', customer: 'cus_delayed', payment_intent: 'pi_delayed',
    metadata: { workspace_id: workspace.id, user_id: userId, plan: 'pro', interval: 'lifetime' },
    line_items: { data: [{ price: { id: 'price_pro_lifetime' } }] },
  } as unknown as Stripe.Checkout.Session;
  const deps = {
    retrieveSubscription: async (): Promise<Stripe.Subscription> => { throw new Error('unexpected subscription'); },
    retrieveCheckoutSession: async () => session,
    retrievePaymentIntent: goodPayments.retrievePaymentIntent,
  };
  await processStripeEvent(store, { type: 'checkout.session.completed', data: { object: session } } as Stripe.Event, deps);
  assert.equal((await store.overview(userId)).subscription.plan, 'free');
  session.payment_status = 'paid';
  await processStripeEvent(store, { type: 'checkout.session.async_payment_succeeded', data: { object: session } } as Stripe.Event, deps);
  assert.equal((await store.overview(userId)).subscription.plan, 'pro');
});

test('a Stripe error is logged and stored as its type and code only, never its message', () => {
  const error = new Stripe.errors.StripeInvalidRequestError({
    message: 'No such customer: cus_PrivateCustomer123; price price_live_abc', type: 'invalid_request_error', code: 'resource_missing',
  });
  assert.equal(errorSummary(error), 'StripeInvalidRequestError invalid_request_error resource_missing');
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const response = billingError(error, 502);
    assert.equal(response.status, 502);
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
  // As the console prints it (an Error argument prints its message and stack).
  assert.doesNotMatch(format(...logged[0]), /cus_PrivateCustomer123|price_live_abc/);
  // Our own errors keep their fixed text, so a failed webhook still says what broke.
  assert.equal(errorSummary(new Error('Stripe subscription has no billable item.')), 'Error: Stripe subscription has no billable item.');
});
