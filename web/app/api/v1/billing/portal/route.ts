import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { getStripe, publicAppUrl } from '@/billing/stripe';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const body = (await req.json().catch(() => ({}))) as { workspaceId?: unknown };
    const overview = await getBillingStore().overview(user, typeof body.workspaceId === 'string' ? body.workspaceId : undefined);
    if (!overview.canManageBilling || !overview.subscription.stripeCustomerId) {
      return Response.json({ error: 'portal_unavailable', message: 'No managed subscription is available for this workspace.' }, { status: 400 });
    }
    const session = await getStripe().billingPortal.sessions.create({ customer: overview.subscription.stripeCustomerId, return_url: `${publicAppUrl(req)}/plan` });
    return Response.json({ url: session.url });
  } catch (error) {
    return billingError(error, 503);
  }
}
