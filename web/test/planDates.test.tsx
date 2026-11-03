import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanManager } from '../app/plan/PlanManager';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { publicBillingOverview } from '../src/billing/presentation';

// The server renders /plan in UTC; the browser hydrates it in the person's own time zone. Any date
// that comes out differently is a hydration mismatch (React #418/#425, seen on production /plan on
// 2 Nov). A period that ends at 03:00 UTC is the previous calendar day in Los Angeles.
async function planIn(timeZone: string, status: 'active' | 'trialing'): Promise<string> {
  const saved = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    const billing = new MemoryBillingStore(() => new Date('2026-11-02T03:00:00.000Z'));
    const owner = crypto.randomUUID();
    const workspace = await billing.ensurePersonalWorkspace(owner);
    await billing.syncSubscription({
      workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status, seats: 1,
      stripeCustomerId: 'cus_dates', stripeSubscriptionId: `sub_${crypto.randomUUID()}`, stripePriceId: 'price_pro_monthly',
      cancelAtPeriodEnd: false, currentPeriodEnd: '2026-12-02T03:00:00.000Z',
    });
    const overview = publicBillingOverview(await billing.overview(owner));
    const html = renderToStaticMarkup(
      <PlanManager initialOverview={overview} initialWorkspaces={await billing.listWorkspaces(owner)} checkoutAvailable lifetimeAvailable={false} paymentsOpen />,
    );
    // Each render makes a new workspace; only its random id may differ between renders.
    return html.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>');
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
}

test('/plan renders the same dates in every time zone, so hydration matches the server', async () => {
  const utc = await planIn('UTC', 'active');
  for (const zone of ['America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
    assert.equal(await planIn(zone, 'active'), utc, zone);
  }
  assert.match(utc, /<span>Renews<\/span><strong>Dec 2, 2026<\/strong>/);
});

test('complimentary Pro (trialing) says Access through, not Renews: it never charges', async () => {
  const html = await planIn('UTC', 'trialing');
  assert.match(html, /<span>Access through<\/span><strong>Dec 2, 2026<\/strong>/);
  assert.doesNotMatch(html, /Renews/);
});
