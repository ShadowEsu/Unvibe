import { errorSummary } from '@/billing/http';
import { getBillingStore } from '@/billing/store';
import { getStripe, paymentsLocked } from '@/billing/stripe';
import { stripeKeyMode, webhookSecretValid } from '@/billing/stripeKey';
import { processStripeEvent } from '@/billing/webhooks';

export const runtime = 'nodejs';
// A claim is a 5-minute lease (claim_billing_webhook). Cap the run well below it so a re-claimed
// delivery never overlaps a still-running original (Vercel's default duration is 300 s).
export const maxDuration = 60;

// While payments are locked, events that take access away are processed in full: a refund or a
// dispute must still end access. A live key whose purchase approval is off still has subscribers,
// so their subscription and invoice events are applied revoke-only: cancellations, unpaid
// subscriptions and failed renewals still downgrade, and nothing is granted or extended. A Checkout
// session this deployment opened before the lock went back on can still be paid; its completion is
// processed revoke-only too, which refunds and cancels it instead of granting. Everything else is
// acknowledged and dropped, as is every other such event on a locked test key, so a sandbox
// delivered to the production API (or a test card on a locked deployment) never grants Pro.
function revokesAccess(type: string): boolean {
  return type === 'customer.subscription.deleted' || type === 'charge.refunded' || type.startsWith('charge.dispute.');
}

// Stripe answers HTTP 409 with code `idempotency_key_in_use` while another request with the same
// idempotency key is still running, say two deliveries stopping the same duplicate at once. The SDK
// raises it as a StripeAPIError carrying that status and code. The other request does the work; this
// delivery is released and answered like one whose claim is still held, so Stripe retries it later.
function idempotencyKeyInUse(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'statusCode' in error && error.statusCode === 409
    && 'code' in error && error.code === 'idempotency_key_in_use';
}

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const keyMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY);
  // A missing or placeholder secret, or one stored with whitespace, is not configured: 503 before any verification.
  if (secret === undefined || !webhookSecretValid(secret) || keyMode === null) return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
  // A request without Stripe's signature header is a bad request, not a server problem.
  if (!signature) return Response.json({ error: 'missing_signature' }, { status: 400 });
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return Response.json({ error: 'invalid_signature' }, { status: 400 });
  }
  const store = getBillingStore();
  // Security L5: an event from the other mode than the admitted key is never ours to apply. It is
  // acknowledged with a 200 so Stripe stops retrying, logged and audited, and never claimed or processed.
  if (event.livemode !== (keyMode === 'live')) {
    console.error(`[billing] webhook ${event.type} ${event.id} ignored: livemode ${event.livemode} does not match the ${keyMode} key`);
    try {
      await store.recordAudit(null, null, 'webhook.livemode_mismatch', { eventId: event.id, eventType: event.type, eventLivemode: event.livemode, keyMode });
    } catch (error) {
      console.error(`[billing] webhook ${event.id} livemode audit failed: ${errorSummary(error)}`);
    }
    return Response.json({ ignored: 'livemode_mismatch' });
  }
  let revokeOnly = false;
  if (paymentsLocked() && !revokesAccess(event.type)) {
    const downgrades = event.type === 'customer.subscription.updated' || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed';
    const ourCheckout = (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')
      && (await store.findCheckoutIntent(event.data.object.id)) !== null;
    if (!ourCheckout && (!event.livemode || !downgrades)) return Response.json({ ignored: 'payments_locked' });
    revokeOnly = true;
  }
  const claim = await store.claimWebhook(event.id, event.type);
  if (claim === 'completed') return Response.json({ received: true, duplicate: true });
  // Another delivery holds the lease and may still die; a non-2xx makes Stripe retry later.
  if (claim === 'in_progress') return Response.json({ error: 'webhook_in_progress' }, { status: 409 });
  try {
    await processStripeEvent(store, event, {
      retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
      retrieveCheckoutSession: (id) => stripe.checkout.sessions.retrieve(id, { expand: ['line_items.data.price'] }),
      invoicesForPaymentIntent: async (paymentIntent) => {
        const invoices = [];
        for await (const { invoice } of stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntent }, expand: ['data.invoice'] })) {
          if (typeof invoice !== 'string' && !invoice.deleted) invoices.push(invoice);
        }
        return invoices;
      },
      // Stripe's cancel defaults to no proration credit. Stripe ignores the key on a DELETE; a cancel
      // that loses a race to another delivery is handled by `cancelNow` in the webhook code.
      cancelSubscription: async (id, idempotencyKey) => {
        await stripe.subscriptions.cancel(id, undefined, { idempotencyKey });
      },
      latestPaidInvoicePayments: async (subscription) => {
        const [invoice] = (await stripe.invoices.list({ subscription, status: 'paid', limit: 1 })).data;
        if (!invoice?.id) return [];
        const payments = [];
        for await (const payment of stripe.invoicePayments.list({ invoice: invoice.id, status: 'paid' })) payments.push(payment);
        return payments;
      },
      paidInvoicePayments: async (invoice) => {
        const payments = [];
        for await (const payment of stripe.invoicePayments.list({ invoice, status: 'paid' })) payments.push(payment);
        return payments;
      },
      refundPayment: async (target, idempotencyKey) => (await stripe.refunds.create(target, { idempotencyKey })).id,
    }, { revokeOnly });
    await store.completeWebhook(event.id);
    return Response.json({ received: true });
  } catch (error) {
    const summary = errorSummary(error);
    await store.failWebhook(event.id, summary);
    console.error(`[billing] webhook ${event.type} ${event.id} failed: ${summary}`);
    if (idempotencyKeyInUse(error)) return Response.json({ error: 'webhook_in_progress' }, { status: 409 });
    return Response.json({ error: 'processing_failed' }, { status: 500 });
  }
}
