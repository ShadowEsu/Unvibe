import type Stripe from 'stripe';
import type { BillingStore, BillingInterval, PlanId, SubscriptionRecord, SubscriptionStatus } from './types';
import { complimentaryPaidEnd, isNewTierPlan, LIFETIME_PERIOD_END, newTiersEnabled } from './plans';
import { stripePriceId } from './stripe';

function mappedStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'trialing' || status === 'active' || status === 'past_due' || status === 'unpaid' || status === 'canceled') return status;
  return 'inactive';
}

function requiredMetadata(subscription: Stripe.Subscription): { workspaceId: string; plan: Exclude<PlanId, 'free'>; interval: BillingInterval } {
  const workspaceId = subscription.metadata.workspace_id;
  const plan = subscription.metadata.plan;
  const interval = subscription.metadata.interval;
  if (!workspaceId || (plan !== 'pro' && plan !== 'teams' && plan !== 'enterprise') || (interval !== 'monthly' && interval !== 'annual')) {
    throw new Error('Stripe subscription metadata is incomplete.');
  }
  return { workspaceId, plan, interval };
}

function providerId(value: string | { id: string } | null): string {
  if (!value) throw new Error('Stripe object is missing a provider identifier.');
  return typeof value === 'string' ? value : value.id;
}

/** The event's Stripe `created` time as ISO, or undefined when the event carries none. */
function eventTime(event: Stripe.Event): string | undefined {
  return typeof event.created === 'number' ? new Date(event.created * 1_000).toISOString() : undefined;
}

/** True when the event is older than the last event already applied to the stored row. */
function olderThanStored(stored: SubscriptionRecord | null, eventAt: string | undefined): boolean {
  return Boolean(stored?.stripeEventAt && eventAt && Date.parse(eventAt) < Date.parse(stored.stripeEventAt));
}

/** The event time to store: the later of the row's and the event's, so a revocation applied out of order never moves it back. */
function laterEventTime(stored: SubscriptionRecord | null, eventAt: string | undefined): string | undefined {
  if (!stored?.stripeEventAt || !eventAt) return eventAt ?? stored?.stripeEventAt;
  return Date.parse(eventAt) < Date.parse(stored.stripeEventAt) ? stored.stripeEventAt : eventAt;
}

/**
 * True when the subscription will not renew again. The Stripe customer portal (API 2026-06-24.dahlia)
 * schedules a cancel by setting `cancel_at` to the period end and leaves `cancel_at_period_end` false,
 * so both are read. A `cancel_at` after this period still renews (and charges) at least once more.
 */
function endsWithoutRenewing(subscription: Stripe.Subscription, currentPeriodEnd: number): boolean {
  if (subscription.cancel_at_period_end) return true;
  return typeof subscription.cancel_at === 'number' && subscription.cancel_at <= currentPeriodEnd;
}

/**
 * Whether Stripe can still charge this live subscription: anything but an ended subscription, or
 * one in good standing that will not renew. A past-due or unpaid one is still being collected.
 */
export function liveSubscriptionStillCharges(subscription: Stripe.Subscription): boolean {
  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') return false;
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const inGoodStanding = subscription.status === 'active' || subscription.status === 'trialing';
  return !(inGoodStanding && periodEnd !== undefined && endsWithoutRenewing(subscription, periodEnd));
}

/** The subscription as Stripe has it now, or null when Stripe has none under that id (deleted, or another account or mode). */
async function retrieveIfExists(deps: StripeWebhookDependencies, id: string): Promise<Stripe.Subscription | null> {
  try {
    return await deps.retrieveSubscription(id);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'resource_missing') return null;
    throw error;
  }
}

/** What to refund for an invoice payment: its PaymentIntent, or a charge made without one. Null for an off-Stripe payment record. */
function refundTarget(payment: Stripe.InvoicePayment.Payment): RefundTarget | null {
  if (payment.payment_intent) return { payment_intent: providerId(payment.payment_intent) };
  if (payment.charge) return { charge: providerId(payment.charge) };
  return null;
}

/**
 * Stops a second subscription that charges for a workspace another subscription already pays for:
 * refunds its latest paid invoice in full, then cancels it now. Refunding first means a failed
 * cancel fails the event, and Stripe's retry still sees two charging subscriptions and finishes
 * both. Every call carries a key derived from the duplicate's id, so a retry never refunds twice.
 * A payment that is already refunded (by support, or by an earlier delivery whose key Stripe has
 * since forgotten after 24 hours) counts as refunded, so the cancel still runs.
 */
async function stopDuplicate(store: BillingStore, deps: StripeWebhookDependencies, workspaceId: string, kept: string, stopped: string): Promise<void> {
  const { latestPaidInvoicePayments, refundPayment, cancelSubscription } = deps;
  if (!latestPaidInvoicePayments || !refundPayment || !cancelSubscription) {
    throw new Error('Stopping a duplicate subscription needs latestPaidInvoicePayments, refundPayment and cancelSubscription.');
  }
  const refunded: string[] = [];
  for (const { payment } of await latestPaidInvoicePayments(stopped)) {
    const target = refundTarget(payment);
    if (!target) continue;
    const paymentId = 'payment_intent' in target ? target.payment_intent : target.charge;
    try {
      refunded.push(await refundPayment(target, `uncode-dup-refund-${stopped}-${paymentId}`));
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'charge_already_refunded')) throw error;
      refunded.push(`already-refunded:${paymentId}`);
    }
  }
  await cancelSubscription(stopped, `uncode-dup-cancel-${stopped}`);
  await store.recordAudit(null, workspaceId, 'subscription.duplicate', { kept, stopped, refunded });
  console.error(`[billing] duplicate subscription stopped: workspace=${workspaceId} kept=${kept} stopped=${stopped} refunds=${refunded.join(',') || 'none'}`);
}

export async function syncStripeSubscription(store: BillingStore, subscription: Stripe.Subscription, deps: StripeWebhookDependencies, eventAt?: string): Promise<void> {
  const metadata = requiredMetadata(subscription);
  // Flag off: an Enterprise subscription is never granted or extended; Stripe can still only take away.
  if (isNewTierPlan(metadata.plan) && !newTiersEnabled()) {
    await applyRevocationOnly(store, subscription, eventAt);
    await store.recordAudit(null, metadata.workspaceId, 'subscription.refused_plan_unavailable', { stripeSubscriptionId: subscription.id, plan: metadata.plan });
    return;
  }
  const item = subscription.items.data[0];
  if (!item) throw new Error('Stripe subscription has no billable item.');
  if (item.price.id !== stripePriceId(metadata.plan, metadata.interval)) throw new Error('Stripe subscription price does not match the trusted plan configuration.');
  if (metadata.plan !== 'teams' && (item.quantity ?? 1) !== 1) throw new Error(`${metadata.plan === 'pro' ? 'Pro' : 'Enterprise'} subscriptions must have exactly one account seat.`);
  if (metadata.plan === 'teams' && (item.quantity ?? 0) < 2) throw new Error('Teams subscriptions require at least two seats.');
  const stored = await store.subscriptionByWorkspaceId(metadata.workspaceId);
  // Stripe does not deliver in order: an event older than the last one applied to this subscription
  // (say a retried invoice.paid after a newer refund ended it) changes nothing.
  if (stored?.stripeSubscriptionId === subscription.id && olderThanStored(stored, eventAt)) {
    await store.recordAudit(null, metadata.workspaceId, 'subscription.ignored_stale_event', { stripeSubscriptionId: subscription.id, eventAt, storedEventAt: stored.stripeEventAt });
    return;
  }
  // Lifetime is paid once and never ends here: a subscription event for the same workspace (say one
  // started from the portal or a stale checkout) is recorded for a person to sort out, never applied.
  if (stored?.interval === 'lifetime' && stored.status === 'active') {
    await store.recordAudit(null, metadata.workspaceId, 'subscription.ignored_lifetime', {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
    });
    return;
  }
  // Checkout refuses a paid subscription while complimentary access runs, but a session opened
  // before a promo code was redeemed can still complete after it. The complimentary row stays; the
  // incoming subscription is refunded and canceled like any duplicate (one set to end at period end
  // was still paid for), with keys from its id, so a replay or a later event for it never refunds or
  // cancels twice. Once it has ended there is nothing left to stop.
  if (stored && complimentaryPaidEnd(stored)) {
    const ended = subscription.status === 'canceled' || subscription.status === 'incomplete_expired';
    if (!ended) await stopDuplicate(store, deps, metadata.workspaceId, 'complimentary', subscription.id);
    return;
  }
  const storedId = stored?.stripeSubscriptionId;
  const replacesOther = stored !== null && storedId !== undefined && storedId !== subscription.id;
  const incomingLive = subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due';
  // A late or retried event for a subscription the workspace has since replaced (say ended sub A
  // after re-subscribing with B) must not overwrite B while B can still charge or entitles.
  if (replacesOther && stored.status !== 'canceled' && stored.status !== 'inactive' && !incomingLive) return;
  if (replacesOther && incomingLive && stored.interval !== 'lifetime') {
    // Checkout refuses a second subscription, so two live ones on a workspace are a real duplicate
    // (say two checkouts that raced). Overwriting the stored one would lose a subscription that keeps
    // charging; the stored one is checked at Stripe, since only Stripe knows if it still charges.
    const other = await retrieveIfExists(deps, storedId);
    if (other && liveSubscriptionStillCharges(other)) {
      // The incoming one ends on its own: the stored one goes on charging and stays on record.
      if (!liveSubscriptionStillCharges(subscription)) return;
      // Both charge: the first one created stays and the newer one is stopped. The id breaks a
      // same-second tie, so the events of both subscriptions agree on which one that is.
      const incomingIsDuplicate = subscription.created > other.created || (subscription.created === other.created && subscription.id > other.id);
      await stopDuplicate(store, deps, metadata.workspaceId, incomingIsDuplicate ? other.id : subscription.id, incomingIsDuplicate ? subscription.id : other.id);
      if (incomingIsDuplicate) return;
    }
  }
  // Only Stripe's live status starts a grace period: a failed-payment event that lands after the
  // subscription was canceled, went unpaid, or expired grants nothing.
  const shouldGrace = subscription.status === 'past_due';
  // Stripe sends an event on every failed retry; the grace period runs from the first failure only.
  const prior = stored?.stripeSubscriptionId === subscription.id ? stored : null;
  const graceEnds = prior?.status === 'grace_period' && prior.gracePeriodEndsAt
    ? prior.gracePeriodEndsAt
    : graceEndsFromNow();
  const status = shouldGrace ? 'grace_period' : mappedStatus(subscription.status);
  // A grant (no access on record for this subscription, or none any more) needs a payment that was
  // neither refunded nor disputed: a refund processed before this event had nothing to revoke yet.
  const enteringAccess = ENTITLING.includes(status) && !(prior && ENTITLING.includes(prior.status));
  if (enteringAccess) {
    const reason = await subscriptionPaymentRefusal(store, deps, subscription.id);
    if (reason) {
      // A fully refunded subscription would keep charging with no access: stop it at Stripe too.
      // This is also how a refund whose revoke failed (below) ends the charges on the next event.
      if (FULL_REFUND.includes(reason)) await cancelAtStripe(deps, subscription.id);
      await store.recordAudit(null, metadata.workspaceId, 'subscription.refused_payment', { stripeSubscriptionId: subscription.id, reason });
      return;
    }
  }
  // The store compares stripe_event_at again inside the write, so a newer event for this subscription
  // applied since the read above (say a concurrent deleted) is never overwritten by this older one.
  const applied = await store.syncSubscription({
    workspaceId: metadata.workspaceId,
    plan: metadata.plan,
    interval: metadata.interval,
    status,
    seats: metadata.plan === 'teams' ? Math.max(2, item.quantity ?? 2) : 1,
    stripeCustomerId: providerId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: item.price.id,
    currentPeriodStart: new Date(item.current_period_start * 1_000).toISOString(),
    currentPeriodEnd: new Date(item.current_period_end * 1_000).toISOString(),
    gracePeriodEndsAt: shouldGrace ? graceEnds : undefined,
    stripeEventAt: laterEventTime(prior, eventAt),
    cancelAtPeriodEnd: endsWithoutRenewing(subscription, item.current_period_end),
  });
  if (!applied) {
    await store.recordAudit(null, metadata.workspaceId, 'subscription.ignored_stale_event', { stripeSubscriptionId: subscription.id, eventAt, atWrite: true });
    return;
  }
  if (!ENTITLING.includes(status)) return;
  // A deleted delivered before this subscription had a row canceled nothing. Once the grant is
  // written, read Stripe again: either that deleted now finds the row, or this read sees it ended.
  const live = await retrieveIfExists(deps, subscription.id);
  if (!live || live.status === 'canceled' || live.status === 'incomplete_expired') {
    await store.markSubscriptionCanceled(subscription.id, eventAt);
    return;
  }
  if (live.status !== 'active' && live.status !== 'trialing') {
    await applyRevocationOnly(store, live, eventAt);
    if (live.status !== 'past_due') return;
  }
  // A first-invoice refund may likewise have matched no row between the payment check and write.
  // Check again, including on a retry of an event whose grant/check/cancel failed after the write.
  // Only a full refund takes the grant back and cancels at Stripe: a partial refund keeps access,
  // and an open dispute only flags (it is handled by the dispute events).
  const retryingGrant = prior && (prior.stripeEventAt === undefined || eventAt === undefined
    ? prior.stripeEventAt === eventAt : Date.parse(prior.stripeEventAt) === Date.parse(eventAt));
  if (enteringAccess || retryingGrant) {
    const reason = await subscriptionPaymentRefusal(store, deps, subscription.id);
    if (reason && FULL_REFUND.includes(reason)) {
      // Access ends even when the Stripe cancel fails. The event then fails, and its retry or any
      // later event for this subscription is refused before the write (above), which cancels again.
      try {
        await cancelAtStripe(deps, subscription.id);
      } finally {
        await store.markSubscriptionCanceled(subscription.id, eventAt);
      }
      await store.recordAudit(null, metadata.workspaceId, 'subscription.refused_payment', { stripeSubscriptionId: subscription.id, reason, afterWrite: true });
    }
  }
}

/** Cancels a refunded subscription at Stripe now, once: every revoke of one subscription shares the key. */
async function cancelAtStripe(deps: StripeWebhookDependencies, subscriptionId: string): Promise<void> {
  if (!deps.cancelSubscription) throw new Error('Revoking a subscription grant needs cancelSubscription.');
  await deps.cancelSubscription(subscriptionId, `uncode-revoke-${subscriptionId}`);
}

/** When a grace period that starts now ends: BILLING_GRACE_PERIOD_DAYS (1 to 30, default 7) from now. */
function graceEndsFromNow(): string {
  const graceDays = Math.max(1, Math.min(30, Number(process.env.BILLING_GRACE_PERIOD_DAYS ?? 7) || 7));
  return new Date(Date.now() + graceDays * 86_400_000).toISOString();
}

const WITHOUT_ACCESS: readonly SubscriptionStatus[] = ['canceled', 'unpaid', 'inactive'];
const ENTITLING: readonly SubscriptionStatus[] = ['active', 'trialing', 'grace_period'];

/**
 * While purchases are locked: applies only what takes paid access away from a subscription already
 * on record. Its plan, seats and period stay as stored and only the status moves down: to canceled,
 * unpaid or inactive when Stripe says so, or into the bounded grace period when a renewal fails from
 * paid standing. A grace period already running is left alone, so repeated failures never restart
 * it. Nothing is created, extended, refunded or canceled here.
 */
async function applyRevocationOnly(store: BillingStore, subscription: Stripe.Subscription, eventAt: string | undefined): Promise<void> {
  const stored = await store.subscriptionByProviderId(subscription.id);
  if (!stored || stored.plan === 'free' || !stored.interval || stored.interval === 'lifetime' || !stored.stripeCustomerId || !stored.stripePriceId) return;
  if (WITHOUT_ACCESS.includes(stored.status)) return;
  let status: SubscriptionStatus;
  let gracePeriodEndsAt: string | undefined;
  if (subscription.status === 'past_due') {
    if (stored.status !== 'active' && stored.status !== 'trialing') return;
    status = 'grace_period';
    gracePeriodEndsAt = graceEndsFromNow();
  } else {
    status = mappedStatus(subscription.status);
    if (!WITHOUT_ACCESS.includes(status)) return;
  }
  const applied = await store.syncSubscription({
    workspaceId: stored.workspaceId,
    plan: stored.plan,
    interval: stored.interval,
    status,
    seats: stored.seats,
    stripeCustomerId: stored.stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: stored.stripePriceId,
    currentPeriodStart: stored.currentPeriodStart,
    currentPeriodEnd: stored.currentPeriodEnd,
    gracePeriodEndsAt,
    cancelAtPeriodEnd: stored.cancelAtPeriodEnd,
    stripeEventAt: laterEventTime(stored, eventAt),
  });
  await store.recordAudit(null, stored.workspaceId, applied ? 'subscription.revoked_while_locked' : 'subscription.ignored_stale_event', { stripeSubscriptionId: subscription.id, status });
}

/** Why a payment must not grant access, or null when it may. */
type PaymentRefusal = 'refund_recorded' | 'not_succeeded' | 'refunded' | 'partly_refunded' | 'disputed';

/** The refusals that are a full refund: the only ones that take a grant back and cancel at Stripe. */
const FULL_REFUND: readonly PaymentRefusal[] = ['refund_recorded', 'refunded'];

/**
 * Checked before every grant: the recorded full refunds first (charge.refunded writes one even when
 * no row matched yet), then the PaymentIntent as Stripe has it now. A Checkout Session stays `paid`
 * after its payment is refunded or disputed, so the session alone is never trusted.
 */
async function paymentRefusal(store: BillingStore, deps: StripeWebhookDependencies, paymentIntentId: string): Promise<PaymentRefusal | null> {
  if (await store.paymentRefunded(paymentIntentId)) return 'refund_recorded';
  if (!deps.retrievePaymentIntent) throw new Error('Granting paid access needs retrievePaymentIntent.');
  const intent = await deps.retrievePaymentIntent(paymentIntentId);
  if (intent.status !== 'succeeded') return 'not_succeeded';
  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string') throw new Error('The PaymentIntent was retrieved without its latest charge.');
  if (charge.refunded || (charge.amount > 0 && charge.amount_refunded >= charge.amount)) return 'refunded';
  if (charge.amount_refunded > 0) return 'partly_refunded';
  if (charge.disputed) return 'disputed';
  return null;
}

/** The refusal for the payments of the subscription's latest paid invoice; null when none was paid yet (a trial). */
async function subscriptionPaymentRefusal(store: BillingStore, deps: StripeWebhookDependencies, subscriptionId: string): Promise<PaymentRefusal | null> {
  if (!deps.latestPaidInvoicePayments) throw new Error('Granting a subscription needs latestPaidInvoicePayments.');
  for (const { payment } of await deps.latestPaidInvoicePayments(subscriptionId)) {
    if (!payment.payment_intent) continue;
    const reason = await paymentRefusal(store, deps, providerId(payment.payment_intent));
    if (reason) return reason;
  }
  return null;
}

async function grantLifetimeFromCheckout(store: BillingStore, session: Stripe.Checkout.Session, deps: StripeWebhookDependencies, eventAt: string | undefined): Promise<void> {
  // Delayed payment methods can complete Checkout before funds settle.
  if (session.payment_status !== 'paid') return;
  const workspaceId = session.metadata?.workspace_id;
  const plan = session.metadata?.plan;
  const interval = session.metadata?.interval;
  if (!workspaceId || (plan !== 'pro' && plan !== 'business') || interval !== 'lifetime') {
    throw new Error('Stripe lifetime checkout metadata is incomplete.');
  }
  // Flag off: a Big Business payment grants nothing (recorded for a person to refund).
  if (plan === 'business' && !newTiersEnabled()) {
    await store.recordAudit(session.metadata?.user_id ?? null, workspaceId, 'checkout.refused_plan_unavailable', { plan, checkoutSessionId: session.id });
    return;
  }
  const expectedPrice = stripePriceId(plan, 'lifetime');
  const linePrice = session.line_items?.data?.[0]?.price;
  const priceId = typeof linePrice === 'string' ? linePrice : linePrice?.id;
  if (priceId !== expectedPrice) {
    throw new Error('Stripe lifetime price does not match the trusted plan configuration.');
  }
  const customerId = providerId(session.customer);
  // A paid payment-mode session always carries its PaymentIntent. Without one there is no payment
  // to check, so nothing is granted.
  if (!session.payment_intent) {
    await store.recordAudit(session.metadata?.user_id ?? null, workspaceId, 'checkout.refused_payment', { plan, checkoutSessionId: session.id, paymentIntentId: null, reason: 'no_payment_intent' });
    return;
  }
  const paymentId = providerId(session.payment_intent);
  // A checkout event can be retried or arrive late. An event older than the last one applied to this
  // payment, a payment whose access was revoked (a refund or a lost dispute leaves its row canceled),
  // and a payment that was refunded or disputed all grant nothing.
  const stored = await store.subscriptionByProviderId(paymentId);
  let reason: PaymentRefusal | 'revoked' | 'stale_event' | null = null;
  if (olderThanStored(stored, eventAt)) reason = 'stale_event';
  else if (stored?.status === 'canceled') reason = 'revoked';
  else reason = await paymentRefusal(store, deps, paymentId);
  if (reason) {
    // A delivery of this same event (same `created`; Postgres and JS print it differently) wrote the
    // row and then failed its check after the write (below): that grant was never confirmed, so it is
    // taken back.
    const writtenByThisEvent = stored?.status === 'active'
      && (stored.stripeEventAt === undefined || eventAt === undefined ? stored.stripeEventAt === eventAt : Date.parse(stored.stripeEventAt) === Date.parse(eventAt));
    if (reason !== 'stale_event' && reason !== 'revoked' && writtenByThisEvent) {
      await store.markSubscriptionCanceled(paymentId, laterEventTime(stored, eventAt));
    }
    await store.recordAudit(session.metadata?.user_id ?? null, workspaceId, 'checkout.refused_payment', { plan, checkoutSessionId: session.id, paymentIntentId: paymentId, reason });
    return;
  }
  const now = new Date().toISOString();
  const applied = await store.syncSubscription({
    workspaceId,
    plan,
    interval: 'lifetime',
    status: 'active',
    seats: 1,
    stripeCustomerId: customerId,
    stripeSubscriptionId: paymentId,
    stripePriceId: expectedPrice,
    currentPeriodStart: now,
    currentPeriodEnd: LIFETIME_PERIOD_END,
    cancelAtPeriodEnd: false,
    stripeEventAt: laterEventTime(stored, eventAt),
  });
  // The store applies the write only if no newer event for this payment landed since the read above.
  if (!applied) {
    await store.recordAudit(session.metadata?.user_id ?? null, workspaceId, 'checkout.refused_payment', { plan, checkoutSessionId: session.id, paymentIntentId: paymentId, reason: 'stale_event' });
    return;
  }
  // A charge.refunded (or dispute) handled between the check above and this write found no row to
  // revoke. Checking again after the write closes that window: if the refund handler looked for the
  // row before it was written, Stripe already had the refund, so this read sees it (or the recorded
  // refund); if it looked after, it found the row and revoked it. A failure here fails the event
  // with the row written; its retry refuses and takes the row back (above).
  const after = await paymentRefusal(store, deps, paymentId);
  if (after) {
    await store.markSubscriptionCanceled(paymentId, laterEventTime(stored, eventAt));
    await store.recordAudit(session.metadata?.user_id ?? null, workspaceId, 'checkout.refused_payment', { plan, checkoutSessionId: session.id, paymentIntentId: paymentId, reason: after, afterWrite: true });
    return;
  }
  await store.completeCheckoutIntent(session.id);
  await store.recordAudit(session.metadata?.user_id ?? null, workspaceId, 'checkout.completed', {
    mode: 'payment',
    plan,
    interval: 'lifetime',
  });
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return subscription ? providerId(subscription) : null;
}

/** A full refund of one payment: its PaymentIntent, or the charge when there is no PaymentIntent. */
export type RefundTarget = { payment_intent: string } | { charge: string };

export interface StripeWebhookDependencies {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  retrieveCheckoutSession?(id: string): Promise<Stripe.Checkout.Session>;
  /** Invoices a PaymentIntent paid. API 2026-06-24.dahlia has no charge.invoice; Stripe links them through Invoice Payments. */
  invoicesForPaymentIntent?(paymentIntentId: string): Promise<Stripe.Invoice[]>;
  /** Cancels a subscription now, not at period end, with no proration credit. A reused key makes a retry a no-op. */
  cancelSubscription?(id: string, idempotencyKey: string): Promise<void>;
  /** The paid payments of the subscription's most recent paid invoice; empty when nothing was paid yet. */
  latestPaidInvoicePayments?(subscriptionId: string): Promise<Stripe.InvoicePayment[]>;
  /** Refunds the whole payment and returns the refund's id. A reused key returns the first refund. */
  refundPayment?(target: RefundTarget, idempotencyKey: string): Promise<string>;
  /** The PaymentIntent with `latest_charge` expanded: whether it succeeded, and whether its charge was refunded or disputed. */
  retrievePaymentIntent?(id: string): Promise<Stripe.PaymentIntent>;
}

type ChargeEventDependencies = Required<Pick<StripeWebhookDependencies, 'invoicesForPaymentIntent' | 'cancelSubscription'>> & StripeWebhookDependencies;

function chargeEventDependencies(deps: StripeWebhookDependencies): ChargeEventDependencies {
  const { invoicesForPaymentIntent, cancelSubscription } = deps;
  if (!invoicesForPaymentIntent || !cancelSubscription) throw new Error('Refund and dispute events need invoicesForPaymentIntent and cancelSubscription.');
  return { ...deps, invoicesForPaymentIntent, cancelSubscription };
}

/** How a payment was matched to a stored subscription. Only `lifetime` and `invoice` matches can end access. */
type PaymentMatch =
  | { via: 'lifetime'; subscription: SubscriptionRecord }
  | { via: 'invoice'; subscription: SubscriptionRecord; invoice: Stripe.Invoice }
  | { via: 'customer'; subscription: SubscriptionRecord }
  | null;

/**
 * The stored subscription a payment paid for: Lifetime grants are stored under their PaymentIntent
 * id; recurring payments link through Invoice Payments to the invoice's subscription; failing that,
 * the customer's subscription row (stripe_customer_id is unique), which only attributes the audit
 * row. Null for a one-off payment.
 */
async function subscriptionForPayment(
  store: BillingStore,
  deps: ChargeEventDependencies,
  paymentIntent: string | Stripe.PaymentIntent | null,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): Promise<PaymentMatch> {
  const paymentIntentId = paymentIntent ? providerId(paymentIntent) : null;
  if (paymentIntentId) {
    const lifetime = await store.subscriptionByProviderId(paymentIntentId);
    if (lifetime?.interval === 'lifetime') return { via: 'lifetime', subscription: lifetime };
    for (const invoice of await deps.invoicesForPaymentIntent(paymentIntentId)) {
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (!subscriptionId) continue;
      const subscription = await store.subscriptionByProviderId(subscriptionId);
      return subscription ? { via: 'invoice', subscription, invoice } : null;
    }
  }
  const byCustomer = customer ? await store.subscriptionByCustomerId(providerId(customer)) : null;
  return byCustomer ? { via: 'customer', subscription: byCustomer } : null;
}

const PERIOD_INVOICE_REASONS: ReadonlySet<Stripe.Invoice.BillingReason> = new Set(['subscription_create', 'subscription_cycle']);

/** True when the invoice is the one that paid the live subscription's current period (not a proration or an older period). */
function paysCurrentPeriod(invoice: Stripe.Invoice, live: Stripe.Subscription): boolean {
  if (!invoice.billing_reason || !PERIOD_INVOICE_REASONS.has(invoice.billing_reason)) return false;
  const currentStart = live.items.data[0]?.current_period_start;
  return currentStart !== undefined && invoice.lines.data.some((line) => line.period.start === currentStart);
}

/**
 * Ends paid access now: Lifetime is revoked; a recurring subscription is canceled at Stripe unless
 * it already ended. With `currentPeriodOnly`, an invoice match must be the current period's invoice.
 * A customer-fallback match never ends access. Returns whether access was ended.
 */
async function revokeAccess(store: BillingStore, deps: ChargeEventDependencies, match: PaymentMatch, currentPeriodOnly: boolean, eventAt: string | undefined): Promise<boolean> {
  if (!match || match.via === 'customer' || !match.subscription.stripeSubscriptionId) return false;
  if (match.via === 'invoice') {
    const live = await deps.retrieveSubscription(match.subscription.stripeSubscriptionId);
    if (currentPeriodOnly && !paysCurrentPeriod(match.invoice, live)) return false;
    if (live.status !== 'canceled' && live.status !== 'incomplete_expired') await deps.cancelSubscription(live.id, `uncode-revoke-${live.id}`);
  }
  // Free at once; the customer.subscription.deleted that follows is then a no-op.
  await store.markSubscriptionCanceled(match.subscription.stripeSubscriptionId, laterEventTime(match.subscription, eventAt));
  return true;
}

async function handleDispute(store: BillingStore, event: Stripe.ChargeDisputeCreatedEvent | Stripe.ChargeDisputeClosedEvent, deps: StripeWebhookDependencies): Promise<void> {
  const charge = chargeEventDependencies(deps);
  const dispute = event.data.object;
  const disputeCharge = typeof dispute.charge === 'string' ? null : dispute.charge;
  const match = await subscriptionForPayment(store, charge, dispute.payment_intent, disputeCharge?.customer ?? null);
  const lost = event.type === 'charge.dispute.closed' && dispute.status === 'lost';
  // A lost dispute is a forced reversal of what that payment bought, whatever period it paid for.
  const revoked = lost && (await revokeAccess(store, charge, match, false, eventTime(event)));
  await store.recordAudit(null, match?.subscription.workspaceId ?? null, event.type === 'charge.dispute.created' ? 'dispute.opened' : 'dispute.closed', {
    eventId: event.id,
    disputeId: dispute.id,
    chargeId: typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    dueBy: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
    stripeSubscriptionId: match?.subscription.stripeSubscriptionId ?? null,
    matchedBy: match?.via ?? null,
    revoked,
  });
}

/**
 * `revokeOnly` (purchases locked): checkout grants nothing, and subscription and invoice events
 * may only take access away from a subscription already on record (`applyRevocationOnly`).
 */
export async function processStripeEvent(store: BillingStore, event: Stripe.Event, deps: StripeWebhookDependencies, options: { revokeOnly?: boolean } = {}): Promise<void> {
  const eventAt = eventTime(event);
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (options.revokeOnly) return;
      const session = event.data.object;
      // Stripe may deliver the webhook before the Checkout API response has been attached
      // to the intent. The server-created intent ID in session metadata closes that race.
      if (session.metadata?.checkout_intent_id) {
        await store.attachCheckoutSession(session.metadata.checkout_intent_id, session.id);
      }
      if (session.mode === 'payment' && session.metadata?.interval === 'lifetime') {
        const full = deps.retrieveCheckoutSession
          ? await deps.retrieveCheckoutSession(session.id)
          : session;
        await grantLifetimeFromCheckout(store, full, deps, eventAt);
        return;
      }
      if (session.mode !== 'subscription' || !session.subscription) return;
      const subscription = await deps.retrieveSubscription(providerId(session.subscription));
      // Flag off: no Enterprise grant from checkout (syncStripeSubscription would refuse it too).
      if (isNewTierPlan(subscription.metadata.plan) && !newTiersEnabled()) {
        await store.recordAudit(null, subscription.metadata.workspace_id ?? null, 'checkout.refused_plan_unavailable', { eventId: event.id, plan: subscription.metadata.plan });
        return;
      }
      await syncStripeSubscription(store, subscription, deps, eventAt);
      await store.completeCheckoutIntent(session.id);
      await store.recordAudit(null, subscription.metadata.workspace_id ?? null, 'checkout.completed', { eventId: event.id });
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      // Stripe does not deliver events in order. Sync the subscription as it is now, never the
      // event's snapshot, so a late older event cannot roll back or resurrect a subscription.
      const live = await deps.retrieveSubscription(event.data.object.id);
      await (options.revokeOnly ? applyRevocationOnly(store, live, eventAt) : syncStripeSubscription(store, live, deps, eventAt));
      return;
    }
    case 'customer.subscription.deleted':
      {
      const prior = await store.subscriptionByProviderId(event.data.object.id);
      await store.markSubscriptionCanceled(event.data.object.id, laterEventTime(prior, eventAt));
      await store.recordAudit(null, prior?.workspaceId ?? null, 'subscription.canceled', { eventId: event.id });
      return;
      }
    case 'invoice.payment_failed':
    case 'invoice.paid': {
      // The live subscription decides: a failure only starts a grace period if Stripe says past_due.
      const id = subscriptionIdFromInvoice(event.data.object);
      if (!id) return;
      const live = await deps.retrieveSubscription(id);
      await (options.revokeOnly ? applyRevocationOnly(store, live, eventAt) : syncStripeSubscription(store, live, deps, eventAt));
      return;
    }
    case 'charge.refunded': {
      // A full refund of what pays for access now (the current period's invoice, or Lifetime) ends it.
      // Refunds of prorations, older periods, or charges matched only by customer are audited only.
      const charge = event.data.object;
      const chargeDeps = chargeEventDependencies(deps);
      const full = charge.refunded || charge.amount_refunded >= charge.amount;
      const match = await subscriptionForPayment(store, chargeDeps, charge.payment_intent, charge.customer);
      const revoked = full && (await revokeAccess(store, chargeDeps, match, true, eventAt));
      await store.recordAudit(null, match?.subscription.workspaceId ?? null, full ? 'refund.full' : 'refund.partial', {
        eventId: event.id,
        chargeId: charge.id,
        paymentIntentId: charge.payment_intent ? providerId(charge.payment_intent) : null,
        amount: charge.amount,
        amountRefunded: charge.amount_refunded,
        currency: charge.currency,
        stripeSubscriptionId: match?.subscription.stripeSubscriptionId ?? null,
        interval: match?.subscription.interval ?? null,
        invoiceBillingReason: match?.via === 'invoice' ? match.invoice.billing_reason : null,
        matchedBy: match?.via ?? null,
        revoked,
      });
      return;
    }
    case 'charge.dispute.created':
    case 'charge.dispute.closed':
      await handleDispute(store, event, deps);
      return;
    default:
      return;
  }
}
