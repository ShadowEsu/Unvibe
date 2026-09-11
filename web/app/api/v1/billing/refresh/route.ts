import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { getStripe } from '@/billing/stripe';
import { processStripeEvent, syncStripeSubscription } from '@/billing/webhooks';
import { publicBillingOverview } from '@/billing/presentation';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const body = (await req.json()) as { sessionId?: unknown };
    if (typeof body.sessionId !== 'string') return Response.json({ error: 'invalid_session' }, { status: 400 });
    const billing = getBillingStore();
    const intent = await billing.findCheckoutIntent(body.sessionId);
    if (!intent || intent.userId !== user) return Response.json({ error: 'checkout_not_found' }, { status: 404 });
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(body.sessionId, { expand: ['line_items.data.price'] });
    if (session.status !== 'complete') return Response.json({ pending: true }, { status: 202 });

    if (session.mode === 'payment' && session.metadata?.interval === 'lifetime') {
      await processStripeEvent(billing, {
        id: `refresh_${session.id}`,
        object: 'event',
        api_version: null,
        created: Math.floor(Date.now() / 1000),
        data: { object: session },
        livemode: session.livemode,
        pending_webhooks: 0,
        request: null,
        type: 'checkout.session.completed',
      } as Stripe.Event, {
        retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
        retrieveCheckoutSession: async () => session,
      });
      return Response.json({ overview: publicBillingOverview(await billing.overview(user, intent.workspaceId)) });
    }

    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (!subscriptionId) return Response.json({ pending: true }, { status: 202 });
    await syncStripeSubscription(billing, await stripe.subscriptions.retrieve(subscriptionId));
    await billing.completeCheckoutIntent(body.sessionId);
    return Response.json({ overview: publicBillingOverview(await billing.overview(user, intent.workspaceId)) });
  } catch (error) { return billingError(error, 503); }
}
