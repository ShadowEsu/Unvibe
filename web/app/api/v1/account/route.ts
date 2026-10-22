import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';
import { getBillingStore } from '@/billing/store';
import type { SubscriptionRecord } from '@/billing/types';

export const runtime = 'nodejs';

/**
 * Whether Stripe can still charge this subscription. Lifetime is a one-time payment, and a
 * subscription set to cancel at period end in good standing renews no more; a past-due one is
 * still being collected.
 */
function stillCharges(subscription: SubscriptionRecord): boolean {
  if (!subscription.stripeSubscriptionId || subscription.status === 'canceled') return false;
  if (subscription.interval === 'lifetime') return false;
  return !(subscription.cancelAtPeriodEnd && (subscription.status === 'active' || subscription.status === 'trialing'));
}

/** Who am I — used by the app to show the signed-in identity. */
export async function GET(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  return Response.json(await getStore().accountInfo(userId));
}

/** App Store requirement: an authenticated user can delete their account and all their data. */
export async function DELETE(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  const billing = getBillingStore();
  const workspaces = await billing.listWorkspaces(userId);
  for (const workspace of workspaces) {
    const overview = await billing.overview(userId, workspace.id);
    if (overview.canManageBilling && stillCharges(overview.subscription)) {
      return Response.json({ error: 'active_subscription', message: 'Cancel the active subscription in Manage billing before deleting this account.' }, { status: 409 });
    }
  }
  await billing.deleteUserBilling(userId);
  await getStore().deleteAccount(userId);
  return Response.json({ ok: true });
}
