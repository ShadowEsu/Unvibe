import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type Stripe from 'stripe';
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
  TEAMS_CHECKOUT_ENABLED,
} from '../src/billing/plans';
import { syncStripeSubscription } from '../src/billing/webhooks';
import { publicBillingOverview } from '../src/billing/presentation';
import { stripePriceId } from '../src/billing/stripe';

test('pricing math matches every published total', () => {
  assert.equal(priceFor('free', 'monthly', 1), 0);
  assert.equal(priceFor('pro', 'monthly', 1), 800);
  assert.equal(priceFor('pro', 'annual', 1), 7_200);
  assert.equal(priceFor('teams', 'monthly', 2), 1_600);
  assert.equal(priceFor('teams', 'monthly', 5), 4_000);
  assert.equal(priceFor('teams', 'annual', 2), 14_400);
  assert.equal(priceFor('teams', 'annual', 5), 36_000);
  assert.equal(proAnnualSavingsPercent(), 25);
  assert.equal(teamsAnnualSavingsPercent(), 25);
});

test('Teams checkout stays paused for private launch', () => {
  assert.equal(TEAMS_CHECKOUT_ENABLED, false);
});

test('Teams rejects abusive seat quantities while Pro stays one-person', () => {
  assert.throws(() => normalizedSeats('teams', 1), /at least 2/i);
  assert.throws(() => normalizedSeats('teams', 2.5), /whole number/i);
  assert.equal(normalizedSeats('teams', 2), 2);
  assert.equal(normalizedSeats('pro', 300), 1);
  assert.equal(minimumSeatsForUsage(3, 2), 5);
});

test('Pro and Teams entitlements use configured allowance scaling', () => {
  assert.equal(planLimit('pro', 'ai_explanation'), 100);
  assert.equal(planLimit('pro', 'indexed_project'), 10);
  assert.equal(planLimit('teams', 'ai_explanation', 2), 200);
  assert.equal(planLimit('teams', 'project_question', 5), 2_500);
  assert.equal(planLimit('teams', 'indexed_project', 5), 10);
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
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), true);
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), false);
  await store.failWebhook(eventId, 'temporary database error');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), true);
  await store.completeWebhook(eventId);
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), false);
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

test('stale checkout intents expire before another checkout starts', async () => {
  let now = new Date('2026-07-16T12:00:00.000Z');
  const store = new MemoryBillingStore(() => now);
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const intent = await store.createCheckoutIntent({ userId, workspaceId: workspace.id, plan: 'pro', interval: 'monthly', seats: 1 });
  assert.equal((await store.pendingCheckout(userId, workspace.id))?.id, intent.id);
  now = new Date('2026-07-16T12:31:00.000Z');
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
  await syncStripeSubscription(store, subscription);
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
  await syncStripeSubscription(store, subscription);
  assert.equal((await store.overview(workspace.ownerUserId)).subscription.plan, 'pro');

  const tampered = { ...subscription, id: 'sub_bad', items: { data: [{ quantity: 2, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] } } as unknown as Stripe.Subscription;
  await assert.rejects(syncStripeSubscription(store, tampered), /exactly one/i);
});
