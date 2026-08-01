import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { getStripe } from '@/billing/stripe';
import { normalizedSeats } from '@/billing/plans';
import { publicBillingOverview } from '@/billing/presentation';

export const runtime = 'nodejs';

export async function PATCH(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
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
    await stripe.subscriptions.update(subscription.id, { items: [{ id: item.id, quantity: seats }], proration_behavior: 'create_prorations' }, { idempotencyKey: `uncode-seats-${subscription.id}-${seats}` });
    const updated = await billing.changeSeatQuantity(user, body.workspaceId, seats);
    await billing.recordAudit(user, body.workspaceId, 'seats.changed', { from: overview.subscription.seats, to: seats });
    return Response.json({ overview: publicBillingOverview(updated) });
  } catch (error) {
    return billingError(error, 503);
  }
}
