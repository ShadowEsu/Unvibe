import { errorSummary } from '@/billing/http';
import { getBillingStore } from '@/billing/store';
import { getStripe, paymentsLocked, stripeKeyIsLive } from '@/billing/stripe';
import { processStripeEvent } from '@/billing/webhooks';

export const runtime = 'nodejs';
// A claim is a 5-minute lease (claim_billing_webhook). Cap the run well below it so a re-claimed
// delivery never overlaps a still-running original (Vercel's default duration is 300 s).
export const maxDuration = 60;

// While payments are locked only events that take access away are processed: a refund or a dispute
// must still end access. Anything that could grant a plan is acknowledged and dropped, so a sandbox
// delivered to the production API (or a test card on a locked deployment) never grants Pro.
function revokesAccess(type: string): boolean {
  return type === 'customer.subscription.deleted' || type === 'charge.refunded' || type.startsWith('charge.dispute.');
}

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !process.env.STRIPE_SECRET_KEY?.trim()) return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
  // A request without Stripe's signature header is a bad request, not a server problem.
  if (!signature) return Response.json({ error: 'missing_signature' }, { status: 400 });
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return Response.json({ error: 'invalid_signature' }, { status: 400 });
  }
  // A 200 so Stripe stops retrying: an event from the other mode than this key is never ours to apply.
  if (event.livemode !== stripeKeyIsLive()) return Response.json({ ignored: 'livemode_mismatch' });
  if (paymentsLocked() && !revokesAccess(event.type)) return Response.json({ ignored: 'payments_locked' });
  const store = getBillingStore();
  const claim = await store.claimWebhook(event.id, event.type);
  if (claim === 'completed') return Response.json({ received: true, duplicate: true });
  // Another delivery holds the lease and may still die; a non-2xx makes Stripe retry later.
  if (claim === 'in_progress') return Response.json({ error: 'webhook_in_progress' }, { status: 409 });
  try {
    await processStripeEvent(store, event, {
      retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
      retrieveCheckoutSession: (id) => stripe.checkout.sessions.retrieve(id, { expand: ['line_items.data.price'] }),
      invoicesForPaymentIntent: async (paymentIntent) => {
        const payments = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntent }, expand: ['data.invoice'] });
        return payments.data.flatMap(({ invoice }) => (typeof invoice === 'string' || invoice.deleted ? [] : [invoice]));
      },
      // Stripe's cancel defaults to no proration credit; the params stay unset so a retried key replays.
      cancelSubscription: async (id, idempotencyKey) => {
        await stripe.subscriptions.cancel(id, undefined, { idempotencyKey });
      },
      latestPaidInvoicePayments: async (subscription) => {
        const [invoice] = (await stripe.invoices.list({ subscription, status: 'paid', limit: 1 })).data;
        if (!invoice?.id) return [];
        return (await stripe.invoicePayments.list({ invoice: invoice.id, status: 'paid' })).data;
      },
      refundPayment: async (target, idempotencyKey) => (await stripe.refunds.create(target, { idempotencyKey })).id,
    });
    await store.completeWebhook(event.id);
    return Response.json({ received: true });
  } catch (error) {
    await store.failWebhook(event.id, errorSummary(error));
    return Response.json({ error: 'processing_failed' }, { status: 500 });
  }
}
