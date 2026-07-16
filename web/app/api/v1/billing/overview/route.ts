import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { stripeIsConfigured } from '@/billing/stripe';
import { publicBillingOverview } from '@/billing/presentation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const workspaceId = new URL(req.url).searchParams.get('workspaceId') ?? undefined;
    const store = getBillingStore();
    const overview = await store.overview(user, workspaceId);
    await store.recordAudit(user, overview.workspace.id, 'plan.viewed', { plan: overview.subscription.plan });
    return Response.json({ overview: publicBillingOverview(overview), workspaces: await store.listWorkspaces(user), checkoutAvailable: stripeIsConfigured() });
  } catch (error) {
    return billingError(error);
  }
}
