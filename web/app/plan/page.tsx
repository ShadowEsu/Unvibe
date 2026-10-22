import { redirect } from 'next/navigation';
import { currentUserId } from '@/lib/session';
import { getBillingStore } from '@/billing/store';
import { checkoutOpen, lifetimeCheckoutOpen, paymentsLocked } from '@/billing/stripe';
import { PlanManager } from './PlanManager';
import { CheckoutReturn } from './CheckoutReturn';
import { publicBillingOverview } from '@/billing/presentation';

export const dynamic = 'force-dynamic';

export default async function PlanPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const userId = await currentUserId();
  if (!userId) {
    // Stripe's return lands in the system browser, which usually has no session: confirm, don't bounce.
    const checkout = searchParams.checkout;
    if (checkout === 'success' || checkout === 'canceled') return <CheckoutReturn outcome={checkout} />;
    redirect('/login');
  }
  const billing = getBillingStore();
  const workspaces = await billing.listWorkspaces(userId);
  const overview = await billing.overview(userId, workspaces[0]?.id);
  return (
    <PlanManager
      initialOverview={publicBillingOverview(overview)}
      initialWorkspaces={workspaces}
      checkoutAvailable={checkoutOpen()}
      lifetimeAvailable={lifetimeCheckoutOpen()}
      paymentsOpen={!paymentsLocked()}
    />
  );
}
