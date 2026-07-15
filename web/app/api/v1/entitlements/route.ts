import { FEATURES, featureAccess } from '@/billing/entitlements';
import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';

/** A compact, renderer-safe entitlement view; private billing/provider data never leaves the server. */
export async function GET(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) return unauthorized();
  const usage = await getStore().usage(userId);
  const features = Object.values(FEATURES).map((feature) => ({
    id: feature.id,
    allowed: featureAccess(usage.planId, feature.id).allowed,
    requiredPlan: feature.requiredPlan,
    beta: feature.beta,
    localAvailability: feature.localAvailability,
  }));
  return Response.json({ plan: usage.planId, usage, features });
}
