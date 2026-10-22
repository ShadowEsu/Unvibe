import { randomUUID } from 'node:crypto';
import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { getStripe, paymentsLocked, PAYMENTS_NOT_OPEN } from '@/billing/stripe';
import { normalizedSeats } from '@/billing/plans';
import { publicBillingOverview } from '@/billing/presentation';

export const runtime = 'nodejs';

export async function PATCH(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  if (paymentsLocked()) return Response.json(PAYMENTS_NOT_OPEN, { status: 503 });
  try {
    const body = (await req.json()) as { workspaceId?: unknown; seats?: unknown };
    if (typeof body.workspaceId !== 'string') return Response.json({ error: 'invalid_workspace' }, { status: 400 });
    const seats = normalizedSeats('teams', Number(body.seats));
    const billing = getBillingStore();
    const overview = await billing.overview(user, body.workspaceId);
    if (!overview.canManageBilling || overview.subscription.plan !== 'teams' || !overview.subscription.stripeSubscriptionId) {
      return Response.json({ error: 'forbidden', message: 'Only the owner of an active Teams workspace can change seats.' }, { status: 403 });
    }
    if (seats < overview.minimumBillableSeats) {
      return Response.json({ error: 'seats_reserved', message: `${overview.minimumBillableSeats} seats are occupied or reserved by pending invitations.` }, { status: 409 });
    }
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(overview.subscription.stripeSubscriptionId);
    const item = subscription.items.data[0];
    if (!item) throw new Error('The Stripe subscription has no seat item.');
    // Stripe replays a reused key's first result for 24 hours, so the key is per request: one built
    // from (subscription, seats) made 3 -> 4 -> 3 -> 4 replay the first change and bill 3 seats. The
    // SDK's own network retries reuse this key; a client re-sending the same change finds Stripe
    // already at the target count and sends nothing.
    if (item.quantity !== seats) {
      await stripe.subscriptions.update(subscription.id, { items: [{ id: item.id, quantity: seats }], proration_behavior: 'create_prorations' }, { idempotencyKey: `uncode-seats-${subscription.id}-${randomUUID()}` });
    }
    const updated = await billing.changeSeatQuantity(user, body.workspaceId, seats);
    await billing.recordAudit(user, body.workspaceId, 'seats.changed', { from: overview.subscription.seats, to: seats });
    return Response.json({ overview: publicBillingOverview(updated) });
  } catch (error) {
    return billingError(error, 503);
  }
}
