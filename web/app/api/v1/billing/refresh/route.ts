import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { publicBillingOverview } from '@/billing/presentation';

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
    // A browser redirect is not proof of payment. Only the signed Stripe webhook may
    // complete the intent and write subscription entitlements.
    if (intent.status !== 'completed') return Response.json({ pending: true }, { status: 202 });
    const overview = await billing.overview(user, intent.workspaceId);
    if (overview.subscription.plan !== intent.plan || overview.subscription.status !== 'active') {
      return Response.json({ pending: true }, { status: 202 });
    }
    return Response.json({ overview: publicBillingOverview(overview) });
  } catch (error) { return billingError(error, 503); }
}
