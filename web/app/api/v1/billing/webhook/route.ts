import { getBillingStore } from '@/billing/store';
import { getStripe } from '@/billing/stripe';
import { processStripeEvent } from '@/billing/webhooks';

export const runtime = 'nodejs';
// A claim is a 5-minute lease (claim_billing_webhook). Cap the run well below it so a re-claimed
// delivery never overlaps a still-running original (Vercel's default duration is 300 s).
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !secret) return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return Response.json({ error: 'invalid_signature' }, { status: 400 });
  }
  const store = getBillingStore();
  if (!(await store.claimWebhook(event.id, event.type))) return Response.json({ received: true, duplicate: true });
  try {
    await processStripeEvent(store, event, {
      retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
      retrieveCheckoutSession: (id) => stripe.checkout.sessions.retrieve(id, { expand: ['line_items.data.price'] }),
      invoicesForPaymentIntent: async (paymentIntent) => {
        const payments = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntent }, expand: ['data.invoice'] });
        return payments.data.flatMap(({ invoice }) => (typeof invoice === 'string' || invoice.deleted ? [] : [invoice]));
      },
      cancelSubscription: async (id) => {
        await stripe.subscriptions.cancel(id, undefined, { idempotencyKey: `uncode-revoke-${id}` });
      },
    });
    await store.completeWebhook(event.id);
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.failWebhook(event.id, message);
    return Response.json({ error: 'processing_failed' }, { status: 500 });
  }
}
