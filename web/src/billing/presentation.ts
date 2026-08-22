import type { BillingOverview, SubscriptionRecord } from './types';

type PublicSubscription = Omit<SubscriptionRecord, 'stripeCustomerId' | 'stripeSubscriptionId' | 'stripePriceId'>;
export type PublicBillingOverview = Omit<BillingOverview, 'subscription'> & {
  subscription: PublicSubscription;
  hasBillingAccount: boolean;
};

/** Provider identifiers stay server-only; clients need only to know whether Portal is available. */
export function publicBillingOverview(overview: BillingOverview): PublicBillingOverview {
  const { stripeCustomerId, stripeSubscriptionId: _stripeSubscriptionId, stripePriceId: _stripePriceId, ...subscription } = overview.subscription;
  return { ...overview, subscription, hasBillingAccount: Boolean(stripeCustomerId) };
}
