import type Stripe from 'stripe';
import type { BillingStore, BillingInterval, CheckoutStopAudits, PlanId, SubscriptionRecord, SubscriptionStatus } from './types';
import { complimentaryPaidEnd } from './plans';
import { STRIPE_PRODUCT, stripePriceId } from './stripe';

/** Far-future end date used for Pro Lifetime grants (effectively permanent). */
export const LIFETIME_PERIOD_END = '2099-12-31T23:59:59.000Z';

function mappedStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'trialing' || status === 'active' || status === 'past_due' || status === 'unpaid' || status === 'canceled') return status;
  return 'inactive';
}

/** Another product's `metadata.product` tag, or null when the object is Unvibe's or carries no tag. */
function otherProductTag(metadata: Stripe.Metadata | null | undefined): string | null {
  const product = metadata?.product;
  return product && product !== STRIPE_PRODUCT ? product.slice(0, 40) : null;
}

/**
 * Security MUST-J1: the Stripe account is shared, and Stripe sends every product's events to every
 * endpoint subscribed to their type. This reads the product tag from the event's own signed object (a
 * session, a subscription, an invoice's snapshot of its subscription's metadata, or a charge) and
 * returns another product's tag, so the event is acknowledged and never processed. Untagged objects
 * return null and keep today's handling, a loud failure included.
 */
export function otherProductOf(event: Stripe.Event): string | null {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'charge.refunded':
      return otherProductTag(event.data.object.metadata);
    case 'invoice.paid':
    case 'invoice.payment_failed':
      return otherProductTag(event.data.object.parent?.subscription_details?.metadata);
    default:
      return null;
  }
}

/** What `processStripeEvent` did when it did not apply the event: another product's object, left alone. */
export type StripeEventOutcome = { ignored: 'other_product'; product: string } | undefined;

function requiredMetadata(subscription: Stripe.Subscription): { workspaceId: string; plan: Exclude<PlanId, 'free'>; interval: BillingInterval } {
  const workspaceId = subscription.metadata.workspace_id;
  const plan = subscription.metadata.plan;
  const interval = subscription.metadata.interval;
  if (!workspaceId || (plan !== 'pro' && plan !== 'teams') || (interval !== 'monthly' && interval !== 'annual')) {
    throw new Error('Stripe subscription metadata is incomplete.');
  }
  return { workspaceId, plan, interval };
}

function providerId(value: string | { id: string } | null): string {
  if (!value) throw new Error('Stripe object is missing a provider identifier.');
  return typeof value === 'string' ? value : value.id;
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

type CancelSubscription = NonNullable<StripeWebhookDependencies['cancelSubscription']>;

/**
 * Cancels a subscription now. Stripe ignores an idempotency key on a DELETE, so when two deliveries
 * stop the same subscription at once, the later cancel finds it already canceled and Stripe answers
 * 404 `resource_missing`. That counts as done once Stripe shows the subscription ended or gone.
 */
async function cancelNow(deps: StripeWebhookDependencies, cancel: CancelSubscription, id: string, idempotencyKey: string): Promise<void> {
  try {
    await cancel(id, idempotencyKey);
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'resource_missing')) throw error;
    const live = await retrieveIfExists(deps, id);
    if (live && live.status !== 'canceled' && live.status !== 'incomplete_expired') throw error;
  }
}

/** What to refund for an invoice payment: its PaymentIntent, or a charge made without one. Null for an off-Stripe payment record. */
function refundTarget(payment: Stripe.InvoicePayment.Payment): RefundTarget | null {
  if (payment.payment_intent) return { payment_intent: providerId(payment.payment_intent) };
  if (payment.charge) return { charge: providerId(payment.charge) };
  return null;
}

/**
 * Refunds a subscription's latest paid invoice in full, then cancels it now, and returns the refund
 * ids. Refunding first means a failed cancel fails the event, and Stripe's retry finishes the job.
 * Every call carries a key derived from the subscription's id, so a retry never refunds twice. A
 * payment that is already refunded (by support, or by an earlier delivery whose key Stripe has since
 * forgotten after 24 hours) counts as refunded, so the cancel still runs.
 */
async function refundAndCancel(deps: StripeWebhookDependencies, stopped: string): Promise<string[]> {
  const { latestPaidInvoicePayments, refundPayment, cancelSubscription } = deps;
  if (!latestPaidInvoicePayments || !refundPayment || !cancelSubscription) {
    throw new Error('Stopping a subscription needs latestPaidInvoicePayments, refundPayment and cancelSubscription.');
  }
  const refunded: string[] = [];
  for (const { payment } of await latestPaidInvoicePayments(stopped)) {
    const target = refundTarget(payment);
    if (!target) continue;
    const paymentId = 'payment_intent' in target ? target.payment_intent : target.charge;
    refunded.push(await refundOnce(refundPayment, target, `uncode-dup-refund-${stopped}-${paymentId}`, paymentId));
  }
  await cancelNow(deps, cancelSubscription, stopped, `uncode-dup-cancel-${stopped}`);
  return refunded;
}

/** A full refund with a key; a payment already refunded counts as refunded (`already-refunded:<id>`). */
async function refundOnce(refundPayment: NonNullable<StripeWebhookDependencies['refundPayment']>, target: RefundTarget, idempotencyKey: string, paymentId: string): Promise<string> {
  try {
    return await refundPayment(target, idempotencyKey);
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'charge_already_refunded')) throw error;
    return `already-refunded:${paymentId}`;
  }
}

/** Stops a second subscription that charges for a workspace another subscription already pays for. */
async function stopDuplicate(store: BillingStore, deps: StripeWebhookDependencies, workspaceId: string, kept: string, stopped: string): Promise<void> {
  const refunded = await refundAndCancel(deps, stopped);
  await store.recordAudit(null, workspaceId, 'subscription.duplicate', { kept, stopped, refunded });
  console.error(`[billing] duplicate subscription stopped: workspace=${workspaceId} kept=${kept} stopped=${stopped} refunds=${refunded.join(',') || 'none'}`);
}

/**
 * While purchases are locked: a Checkout session opened before the lock went back on can still be
 * paid (a session lives up to CHECKOUT_SESSION_TTL_MS). Nothing is granted for it. Its subscription
 * is refunded and canceled now, or its Lifetime payment refunded, so it never ends with a charge and
 * nothing stored, and its checkout intent is closed. A subscription or Lifetime payment already on
 * record with access (paid for while purchases were open) is left to the revoke-only rules.
 *
 * A paid session is complete only once a refund was made. When Stripe shows no refundable payment
 * for it yet, the event fails without the completion row, so Stripe retries it and the canceled
 * recovery branch refunds the payment once Stripe shows it. An unpaid session (say a free first
 * period, `no_payment_required`) is stopped without a refund and without the completion row.
 *
 * A stop that started while locked (`checkout.stop_started` without `checkout.stopped_while_locked`)
 * always finishes here, even when its retry arrives after purchases reopen (`processStripeEvent`).
 * A finished stop (its `checkout.stopped_while_locked` row exists) is left as it is: no Stripe call
 * and no new row, whatever event or lock state brings it back. `audits` is the caller's one read of
 * both stop rows for this session (`BillingStore.checkoutStopAudits`).
 */
async function stopCheckoutWhileLocked(store: BillingStore, session: Stripe.Checkout.Session, deps: StripeWebhookDependencies, audits: CheckoutStopAudits): Promise<void> {
  const workspaceId = session.metadata?.workspace_id ?? null;
  let stopped: string | null = null;
  let refunded: string[] = [];
  if (audits.finished) return;
  const { started } = audits;
  if (session.mode === 'subscription' && session.subscription) {
    const id = providerId(session.subscription);
    const stored = await store.subscriptionByProviderId(id);
    // A subscription paid for while purchases were open is left to the revoke-only rules. One whose
    // stop already started (say the refund went through and the cancel failed, then a subscription
    // event stored it as active after a reopen) is ours to finish: refund (same key) and cancel.
    const storedWithAccess = stored !== null && !WITHOUT_ACCESS.includes(stored.status);
    if (storedWithAccess && !started) return;
    const live = await retrieveIfExists(deps, id);
    const liveGone = !live || live.status === 'canceled' || live.status === 'incomplete_expired';
    // Every write below is conditional on the status this run read (Security R8-1): a complimentary
    // grant or another event that changed the row since is left alone instead of being canceled.
    const cancelStored = async () => { if (storedWithAccess) await store.setSubscriptionStatusIf(id, stored.status, 'canceled'); };
    // A started stop whose subscription Stripe already ended (say the cancel went through and the
    // write after it failed, on an unpaid or no_payment_required session) loses access now, not when
    // customer.subscription.deleted arrives (Security R8-2).
    if (started && liveGone) await cancelStored();
    if (!liveGone) {
      if (!started) {
        await store.recordAudit(null, workspaceId, 'checkout.stop_started', { checkoutSessionId: session.id, subscriptionId: id });
      }
      refunded = await refundAndCancel(deps, id);
      // Stripe has canceled it: a row a subscription event stored as active loses access now, not
      // when customer.subscription.deleted arrives (the same write that handler makes).
      await cancelStored();
      stopped = id;
    } else if (live?.status === 'canceled' && session.payment_status === 'paid' && started) {
      // A refund and cancel may have succeeded before the audit failed. Shared refund keys recover
      // the result without another refund; the completion row, once written, ends the stop above.
      // The row was marked canceled above.
      if (!session.invoice || !deps.paidInvoicePayments || !deps.refundPayment) {
        throw new Error('Refunding a settled locked checkout needs its invoice, paidInvoicePayments and refundPayment.');
      }
      for (const { payment } of await deps.paidInvoicePayments(providerId(session.invoice))) {
        const target = refundTarget(payment);
        if (!target) continue;
        const paymentId = 'payment_intent' in target ? target.payment_intent : target.charge;
        refunded.push(await refundOnce(deps.refundPayment, target, `uncode-dup-refund-${id}-${paymentId}`, paymentId));
      }
      stopped = id;
    }
  } else if (session.mode === 'payment' && session.payment_status === 'paid' && session.payment_intent) {
    const paymentIntent = providerId(session.payment_intent);
    const stored = await store.subscriptionByProviderId(paymentIntent);
    if (stored && !WITHOUT_ACCESS.includes(stored.status)) return;
    if (!deps.refundPayment) throw new Error('Stopping a locked Lifetime checkout needs refundPayment.');
    // Recorded before the refund, so a refund that fails while locked is retried as a stop after a
    // reopen (`processStripeEvent` routes it here) instead of granting Lifetime.
    if (!started) {
      await store.recordAudit(null, workspaceId, 'checkout.stop_started', { checkoutSessionId: session.id, paymentIntentId: paymentIntent });
    }
    refunded = [await refundOnce(deps.refundPayment, { payment_intent: paymentIntent }, `uncode-locked-refund-${paymentIntent}`, paymentIntent)];
    stopped = paymentIntent;
  }
  // Closed before the retry throw, so a stop still retrying never leaves a pending intent that
  // answers checkout_pending after a reopen. Expiring only a pending intent makes this safe to repeat.
  const intent = await store.findCheckoutIntent(session.id);
  if (intent) await store.expireCheckoutIntent(intent.id);
  if (stopped && session.payment_status === 'paid' && refunded.length === 0) {
    throw new Error(`Locked checkout ${session.id} is paid but no payment found to refund yet; failing so Stripe retries.`);
  }
  if (!stopped || (session.payment_status !== 'paid' && refunded.length === 0)) return;
  await store.recordAudit(null, workspaceId, 'checkout.stopped_while_locked', { checkoutSessionId: session.id, stopped, refunded });
  console.error(`[billing] checkout completed while payments are locked, stopped: workspace=${workspaceId} stopped=${stopped} refunds=${refunded.join(',') || 'none'}`);
}

/**
 * Stores a subscription as Stripe has it. The write is a compare-and-set on the row as this run read
 * it (the unlocked-upsert race, Security 0344 N2 and the before-live list): when another write lands
 * in between (a lost dispute or a refund that canceled it, a free-months grant, the sync of another
 * subscription), nothing is written; the subscription is retrieved again, the row read again and the
 * decision made again. Losing three times fails the event, so Stripe retries it.
 */
export async function syncStripeSubscription(store: BillingStore, subscription: Stripe.Subscription, deps: StripeWebhookDependencies): Promise<void> {
  let live = subscription;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) live = await deps.retrieveSubscription(subscription.id);
    if (await syncStripeSubscriptionOnce(store, live, deps)) return;
  }
  throw new Error('Subscription sync lost to concurrent changes three times.');
}

/** One read-decide-write round of `syncStripeSubscription`. False when the row changed after the read and nothing was written. */
async function syncStripeSubscriptionOnce(store: BillingStore, subscription: Stripe.Subscription, deps: StripeWebhookDependencies): Promise<boolean> {
  const metadata = requiredMetadata(subscription);
  const item = subscription.items.data[0];
  if (!item) throw new Error('Stripe subscription has no billable item.');
  if (item.price.id !== stripePriceId(metadata.plan, metadata.interval)) throw new Error('Stripe subscription price does not match the trusted plan configuration.');
  if (metadata.plan === 'pro' && (item.quantity ?? 1) !== 1) throw new Error('Pro subscriptions must have exactly one account seat.');
  if (metadata.plan === 'teams' && (item.quantity ?? 0) < 2) throw new Error('Teams subscriptions require at least two seats.');
  const read = await store.versionedSubscriptionByWorkspaceId(metadata.workspaceId);
  const stored = read?.subscription ?? null;
  // Stripe never reopens a canceled subscription, and this row is marked canceled only once Stripe
  // has canceled it. A snapshot that still shows it live was read before that mark: it is stale.
  if (stored?.stripeSubscriptionId === subscription.id && stored.status === 'canceled' && subscription.status !== 'canceled') return true;
  // Lifetime is paid once and never ends here: a subscription event for the same workspace (say one
  // started from the portal or a stale checkout) is recorded for a person to sort out, never applied.
  if (stored?.interval === 'lifetime' && stored.status === 'active') {
    await store.recordAudit(null, metadata.workspaceId, 'subscription.ignored_lifetime', {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
    });
    return true;
  }
  // Checkout refuses a paid subscription while complimentary access runs, but a session opened
  // before a promo code was redeemed can still complete after it. The complimentary row stays; the
  // incoming subscription is refunded and canceled like any duplicate (one set to end at period end
  // was still paid for), with keys from its id, so a replay or a later event for it never refunds or
  // cancels twice. Once it has ended there is nothing left to stop. An incomplete one is still
  // waiting on its first payment (say a 3DS challenge): there is nothing to refund yet, and a cancel
  // now could leave a payment the customer completes later unrefunded. It is left alone until its
  // invoice.paid, its update to active or the checkout completion stops it, refund first.
  if (stored && complimentaryPaidEnd(stored)) {
    if (subscription.status === 'incomplete') return true;
    const ended = subscription.status === 'canceled' || subscription.status === 'incomplete_expired';
    if (!ended) await stopDuplicate(store, deps, metadata.workspaceId, 'complimentary', subscription.id);
    return true;
  }
  const storedId = stored?.stripeSubscriptionId;
  const replacesOther = stored !== null && storedId !== undefined && storedId !== subscription.id;
  const incomingLive = subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due';
  // A late or retried event for a subscription the workspace has since replaced (say ended sub A
  // after re-subscribing with B) must not overwrite B while B can still charge or entitles.
  if (replacesOther && stored.status !== 'canceled' && stored.status !== 'inactive' && !incomingLive) return true;
  if (replacesOther && incomingLive && stored.interval !== 'lifetime') {
    // Checkout refuses a second subscription, so two live ones on a workspace are a real duplicate
    // (say two checkouts that raced). Overwriting the stored one would lose a subscription that keeps
    // charging; the stored one is checked at Stripe, since only Stripe knows if it still charges.
    const other = await retrieveIfExists(deps, storedId);
    if (other && liveSubscriptionStillCharges(other)) {
      // The incoming one ends on its own: the stored one goes on charging and stays on record.
      if (!liveSubscriptionStillCharges(subscription)) return true;
      // Both charge: the first one created stays and the newer one is stopped. The id breaks a
      // same-second tie, so the events of both subscriptions agree on which one that is.
      const incomingIsDuplicate = subscription.created > other.created || (subscription.created === other.created && subscription.id > other.id);
      await stopDuplicate(store, deps, metadata.workspaceId, incomingIsDuplicate ? other.id : subscription.id, incomingIsDuplicate ? subscription.id : other.id);
      if (incomingIsDuplicate) return true;
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
  return store.syncSubscriptionIf({
    workspaceId: metadata.workspaceId,
    plan: metadata.plan,
    interval: metadata.interval,
    status: shouldGrace ? 'grace_period' : mappedStatus(subscription.status),
    seats: metadata.plan === 'teams' ? Math.max(2, item.quantity ?? 2) : 1,
    stripeCustomerId: providerId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: item.price.id,
    currentPeriodStart: new Date(item.current_period_start * 1_000).toISOString(),
    currentPeriodEnd: new Date(item.current_period_end * 1_000).toISOString(),
    gracePeriodEndsAt: shouldGrace ? graceEnds : undefined,
    cancelAtPeriodEnd: endsWithoutRenewing(subscription, item.current_period_end),
  }, read?.version ?? null);
}

/** When a grace period that starts now ends: BILLING_GRACE_PERIOD_DAYS (1 to 30, default 7) from now. */
function graceEndsFromNow(): string {
  const graceDays = Math.max(1, Math.min(30, Number(process.env.BILLING_GRACE_PERIOD_DAYS ?? 7) || 7));
  return new Date(Date.now() + graceDays * 86_400_000).toISOString();
}

const WITHOUT_ACCESS: readonly SubscriptionStatus[] = ['canceled', 'unpaid', 'inactive'];

/**
 * While purchases are locked: applies only what takes paid access away from a subscription already
 * on record. Its plan, seats and period stay as stored and only the status moves down: to canceled,
 * unpaid or inactive when Stripe says so, or into the bounded grace period when a renewal fails from
 * paid standing. A grace period already running is left alone, so repeated failures never restart
 * it. A grace period whose renewal Stripe then collects ends: the row is active again with its stored
 * period, so a recovered subscriber is not dropped to Free when the grace runs out. Nothing is
 * created, extended, refunded or canceled here.
 *
 * Each write applies only while the row still has the status it was decided from (a compare-and-set
 * in the store). If another event changed it in between (say a lost dispute canceled it), the
 * decision is made again from the row as it is now.
 */
async function applyRevocationOnly(store: BillingStore, subscription: Stripe.Subscription): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stored = await store.subscriptionByProviderId(subscription.id);
    if (!stored || stored.plan === 'free' || !stored.interval || stored.interval === 'lifetime' || !stored.stripeCustomerId || !stored.stripePriceId) return;
    if (WITHOUT_ACCESS.includes(stored.status)) return;
    let status: SubscriptionStatus;
    let gracePeriodEndsAt: string | undefined;
    if (subscription.status === 'past_due') {
      if (stored.status !== 'active' && stored.status !== 'trialing') return;
      status = 'grace_period';
      gracePeriodEndsAt = graceEndsFromNow();
    } else if (stored.status === 'grace_period' && (subscription.status === 'active' || subscription.status === 'trialing')) {
      // The row was found by this subscription's id, so it is the one that failed and now recovered.
      status = 'active';
    } else {
      status = mappedStatus(subscription.status);
      if (!WITHOUT_ACCESS.includes(status)) return;
    }
    if (await store.setSubscriptionStatusIf(subscription.id, stored.status, status, gracePeriodEndsAt)) {
      await store.recordAudit(null, stored.workspaceId, status === 'active' ? 'subscription.recovered_while_locked' : 'subscription.revoked_while_locked', { stripeSubscriptionId: subscription.id, status });
      return;
    }
  }
  throw new Error('Revoke-only update lost to concurrent changes three times.');
}

async function grantLifetimeFromCheckout(store: BillingStore, session: Stripe.Checkout.Session): Promise<void> {
  // Delayed payment methods can complete Checkout before funds settle.
  if (session.payment_status !== 'paid') return;
  const workspaceId = session.metadata?.workspace_id;
  const plan = session.metadata?.plan;
  const interval = session.metadata?.interval;
  if (!workspaceId || plan !== 'pro' || interval !== 'lifetime') {
    throw new Error('Stripe lifetime checkout metadata is incomplete.');
  }
  const expectedPrice = stripePriceId('pro', 'lifetime');
  const linePrice = session.line_items?.data?.[0]?.price;
  const priceId = typeof linePrice === 'string' ? linePrice : linePrice?.id;
  if (priceId !== expectedPrice) {
    throw new Error('Stripe lifetime price does not match the trusted plan configuration.');
  }
  const customerId = providerId(session.customer);
  const paymentId = session.payment_intent
    ? providerId(session.payment_intent)
    : `lifetime_${session.id}`;
  const now = new Date().toISOString();
  await store.syncSubscription({
    workspaceId,
    plan: 'pro',
    interval: 'lifetime',
    status: 'active',
    seats: 1,
    stripeCustomerId: customerId,
    stripeSubscriptionId: paymentId,
    stripePriceId: expectedPrice,
    currentPeriodStart: now,
    currentPeriodEnd: LIFETIME_PERIOD_END,
    cancelAtPeriodEnd: false,
  });
  await store.completeCheckoutIntent(session.id);
  await store.recordAudit(session.metadata?.user_id ?? null, workspaceId, 'checkout.completed', {
    mode: 'payment',
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
  /** Cancels a subscription now, not at period end, with no proration credit. Stripe ignores the key on this DELETE; see `cancelNow`. */
  cancelSubscription?(id: string, idempotencyKey: string): Promise<void>;
  /** The paid payments of the subscription's most recent paid invoice; empty when nothing was paid yet. */
  latestPaidInvoicePayments?(subscriptionId: string): Promise<Stripe.InvoicePayment[]>;
  /** Paid payments of this exact Checkout session's invoice, even after its subscription ended. */
  paidInvoicePayments?(invoiceId: string): Promise<Stripe.InvoicePayment[]>;
  /** Refunds the whole payment and returns the refund's id. A reused key returns the first refund. */
  refundPayment?(target: RefundTarget, idempotencyKey: string): Promise<string>;
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
async function revokeAccess(store: BillingStore, deps: ChargeEventDependencies, match: PaymentMatch, currentPeriodOnly: boolean): Promise<boolean> {
  if (!match || match.via === 'customer' || !match.subscription.stripeSubscriptionId) return false;
  if (match.via === 'invoice') {
    const live = await deps.retrieveSubscription(match.subscription.stripeSubscriptionId);
    if (currentPeriodOnly && !paysCurrentPeriod(match.invoice, live)) return false;
    if (live.status !== 'canceled' && live.status !== 'incomplete_expired') await cancelNow(deps, deps.cancelSubscription, live.id, `uncode-revoke-${live.id}`);
  }
  // Free at once; the customer.subscription.deleted that follows is then a no-op.
  await store.markSubscriptionCanceled(match.subscription.stripeSubscriptionId);
  return true;
}

async function handleDispute(store: BillingStore, event: Stripe.ChargeDisputeCreatedEvent | Stripe.ChargeDisputeClosedEvent, deps: StripeWebhookDependencies): Promise<void> {
  const charge = chargeEventDependencies(deps);
  const dispute = event.data.object;
  const disputeCharge = typeof dispute.charge === 'string' ? null : dispute.charge;
  const match = await subscriptionForPayment(store, charge, dispute.payment_intent, disputeCharge?.customer ?? null);
  const lost = event.type === 'charge.dispute.closed' && dispute.status === 'lost';
  // A lost dispute is a forced reversal of what that payment bought, whatever period it paid for.
  const revoked = lost && (await revokeAccess(store, charge, match, false));
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
 * `revokeOnly` (purchases locked): checkout grants nothing (a completed one is stopped instead,
 * `stopCheckoutWhileLocked`), and subscription and invoice events may only take access away from a
 * subscription already on record (`applyRevocationOnly`). Whatever the lock state, a checkout whose
 * stop started or finished while locked goes to `stopCheckoutWhileLocked` and is never completed:
 * a retry after purchases reopen still refunds instead of granting, and a finished stop stays as is.
 */
export async function processStripeEvent(store: BillingStore, event: Stripe.Event, deps: StripeWebhookDependencies, options: { revokeOnly?: boolean } = {}): Promise<StripeEventOutcome> {
  const tagged = otherProductOf(event);
  if (tagged) return { ignored: 'other_product', product: tagged };
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (options.revokeOnly) {
        await stopCheckoutWhileLocked(store, session, deps, await store.checkoutStopAudits(session.id));
        return;
      }
      // One query for both stop rows; a failed read fails the event, so nothing is granted.
      const audits = await store.checkoutStopAudits(session.id);
      if (audits.started || audits.finished) {
        await stopCheckoutWhileLocked(store, session, deps, audits);
        return;
      }
      // Stripe may deliver the webhook before the Checkout API response has been attached
      // to the intent. The server-created intent ID in session metadata closes that race.
      if (session.metadata?.checkout_intent_id) {
        await store.attachCheckoutSession(session.metadata.checkout_intent_id, session.id);
      }
      if (session.mode === 'payment' && session.metadata?.interval === 'lifetime') {
        const full = deps.retrieveCheckoutSession
          ? await deps.retrieveCheckoutSession(session.id)
          : session;
        await grantLifetimeFromCheckout(store, full);
        return;
      }
      if (session.mode !== 'subscription' || !session.subscription) return;
      const subscription = await deps.retrieveSubscription(providerId(session.subscription));
      const subscriptionProduct = otherProductTag(subscription.metadata);
      if (subscriptionProduct) return { ignored: 'other_product', product: subscriptionProduct };
      await syncStripeSubscription(store, subscription, deps);
      await store.completeCheckoutIntent(session.id);
      await store.recordAudit(null, subscription.metadata.workspace_id ?? null, 'checkout.completed', { eventId: event.id });
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      // Stripe does not deliver events in order. Sync the subscription as it is now, never the
      // event's snapshot, so a late older event cannot roll back or resurrect a subscription.
      const live = await deps.retrieveSubscription(event.data.object.id);
      // The live subscription's tag decides too, in case the event's snapshot predates it.
      const liveProduct = otherProductTag(live.metadata);
      if (liveProduct) return { ignored: 'other_product', product: liveProduct };
      await (options.revokeOnly ? applyRevocationOnly(store, live) : syncStripeSubscription(store, live, deps));
      return;
    }
    case 'customer.subscription.deleted':
      {
      const prior = await store.subscriptionByProviderId(event.data.object.id);
      await store.markSubscriptionCanceled(event.data.object.id);
      await store.recordAudit(null, prior?.workspaceId ?? null, 'subscription.canceled', { eventId: event.id });
      return;
      }
    case 'invoice.payment_failed':
    case 'invoice.paid': {
      // The live subscription decides: a failure only starts a grace period if Stripe says past_due.
      const id = subscriptionIdFromInvoice(event.data.object);
      if (!id) return;
      const live = await deps.retrieveSubscription(id);
      const liveProduct = otherProductTag(live.metadata);
      if (liveProduct) return { ignored: 'other_product', product: liveProduct };
      await (options.revokeOnly ? applyRevocationOnly(store, live) : syncStripeSubscription(store, live, deps));
      return;
    }
    case 'charge.refunded': {
      // A full refund of what pays for access now (the current period's invoice, or Lifetime) ends it.
      // Refunds of prorations, older periods, or charges matched only by customer are audited only.
      const charge = event.data.object;
      const chargeDeps = chargeEventDependencies(deps);
      const full = charge.refunded || charge.amount_refunded >= charge.amount;
      const match = await subscriptionForPayment(store, chargeDeps, charge.payment_intent, charge.customer);
      const revoked = full && (await revokeAccess(store, chargeDeps, match, true));
      await store.recordAudit(null, match?.subscription.workspaceId ?? null, full ? 'refund.full' : 'refund.partial', {
        eventId: event.id,
        chargeId: charge.id,
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
