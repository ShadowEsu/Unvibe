import Stripe from 'stripe';
import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';
import { getBillingStore } from '@/billing/store';
import { getStripe } from '@/billing/stripe';
import type { SubscriptionRecord } from '@/billing/types';
import { liveSubscriptionStillCharges } from '@/billing/webhooks';

export const runtime = 'nodejs';

/**
 * Whether Stripe can still charge this subscription. Lifetime is a one-time payment, and a canceled
 * subscription stays canceled. Anything else is decided on the live Stripe subscription, not the
 * stored row: a portal change ("Don't cancel", or a new cancel) can be seconds ahead of its webhook.
 * A subscription Stripe does not have (resource_missing) cannot charge. Any other error throws.
 */
async function stillCharges(subscription: SubscriptionRecord): Promise<boolean> {
  const id = subscription.stripeSubscriptionId;
  if (!id || subscription.status === 'canceled') return false;
  if (subscription.interval === 'lifetime') return false;
  try {
    return liveSubscriptionStillCharges(await getStripe().subscriptions.retrieve(id));
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.code !== 'resource_missing') throw error;
    console.warn('account delete: stored subscription not found at Stripe; treated as not charging', id);
    return false;
  }
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
    if (!overview.canManageBilling) continue;
    let charges: boolean;
    try {
      charges = await stillCharges(overview.subscription);
    } catch (error) {
      // Unknown billing state: never delete an account Stripe might keep charging.
      console.error('account delete: subscription check failed', error instanceof Error ? error.message : error);
      return Response.json({ error: 'billing_unavailable', message: 'We could not check your subscription. Nothing was deleted. Try again in a minute.' }, { status: 503 });
    }
    if (charges) {
      return Response.json({ error: 'active_subscription', message: 'Cancel the active subscription in Manage billing before deleting this account.' }, { status: 409 });
    }
  }
  await billing.deleteUserBilling(userId);
  await getStore().deleteAccount(userId);
  return Response.json({ ok: true });
}
