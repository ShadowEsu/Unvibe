import { redirect } from 'next/navigation';
import { currentUserId } from '@/lib/session';
import { getBillingStore } from '@/billing/store';
import { stripeIsConfigured } from '@/billing/stripe';
import { PlanManager } from './PlanManager';
import { publicBillingOverview } from '@/billing/presentation';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const userId = await currentUserId();
  if (!userId) redirect('/login');
  const billing = getBillingStore();
  const workspaces = await billing.listWorkspaces(userId);
  const overview = await billing.overview(userId, workspaces[0]?.id);
  return <PlanManager initialOverview={publicBillingOverview(overview)} initialWorkspaces={workspaces} checkoutAvailable={stripeIsConfigured()} />;
}
