import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanManager } from '../app/plan/PlanManager';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { publicBillingOverview } from '../src/billing/presentation';
import type { BillingInterval } from '../src/billing/types';

// Render the real Plan page component for a Teams owner with a real (memory) billing overview.
async function teamsPlan(interval: BillingInterval, seats: number): Promise<string> {
  const billing = new MemoryBillingStore();
  const owner = crypto.randomUUID();
  const team = await billing.createTeamWorkspace(owner, 'Seat estimate');
  await billing.syncSubscription({
    workspaceId: team.id, plan: 'teams', interval, status: 'active', seats,
    stripeCustomerId: 'cus_seats', stripeSubscriptionId: 'sub_seats', stripePriceId: 'price_teams',
    cancelAtPeriodEnd: false,
  });
  const overview = publicBillingOverview(await billing.overview(owner, team.id));
  return renderToStaticMarkup(
    <PlanManager initialOverview={overview} initialWorkspaces={await billing.listWorkspaces(owner)} checkoutAvailable lifetimeAvailable={false} paymentsOpen />,
  );
}

test('the Teams seat estimate uses the published $72 per seat per year', async () => {
  const html = await teamsPlan('annual', 3);
  assert.match(html, /Estimated recurring total<\/small><strong>\$216\/year<\/strong>/);
});

test('the Teams seat estimate uses $8 per seat per month', async () => {
  const html = await teamsPlan('monthly', 3);
  assert.match(html, /Estimated recurring total<\/small><strong>\$24\/month<\/strong>/);
});

test('the seat field allows only the seats checkout and the seats API accept (2 to 20)', async () => {
  const html = await teamsPlan('monthly', 3);
  assert.match(html, /<input type="number" min="2" max="20" value="3"\/>/);
});
