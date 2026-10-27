import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { PLAN_NAMES } from '@/billing/plans';

const EVENTS = new Set(['plan.comparison_viewed', 'upgrade_prompt.clicked', 'checkout.canceled']);

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const body = (await req.json()) as { event?: unknown; workspaceId?: unknown; plan?: unknown; interval?: unknown };
    if (typeof body.event !== 'string' || !EVENTS.has(body.event)) return Response.json({ error: 'invalid_event' }, { status: 400 });
    const billing = getBillingStore();
    const overview = await billing.overview(user, typeof body.workspaceId === 'string' ? body.workspaceId : undefined);
    const metadata: Record<string, string> = {};
    if (typeof body.plan === 'string' && Object.hasOwn(PLAN_NAMES, body.plan)) metadata.plan = body.plan;
    if (body.interval === 'monthly' || body.interval === 'annual') metadata.interval = body.interval;
    await billing.recordAudit(user, overview.workspace.id, body.event, metadata);
    return Response.json({ ok: true });
  } catch (error) { return billingError(error); }
}
