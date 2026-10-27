import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanManager } from '../app/plan/PlanManager';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { publicBillingOverview } from '../src/billing/presentation';
import type { PlanId } from '../src/billing/types';

// The real web Plan page component, rendered for each kind of account on a real (memory) billing overview.
async function plan(planId: PlanId, opts: { checkoutAvailable: boolean; paymentsOpen: boolean }): Promise<string> {
  const billing = new MemoryBillingStore();
  const owner = crypto.randomUUID();
  const personal = await billing.ensurePersonalWorkspace(owner);
  const workspace = planId === 'teams' ? await billing.createTeamWorkspace(owner, 'Team') : personal;
  if (planId !== 'free') {
    const oneTime = planId === 'business';
    await billing.syncSubscription({
      workspaceId: workspace.id, plan: planId, interval: oneTime ? 'lifetime' : 'monthly', status: 'active', seats: planId === 'teams' ? 4 : 1,
      stripeCustomerId: `cus_${planId}`, stripeSubscriptionId: `sub_${planId}`, stripePriceId: `price_${planId}`, cancelAtPeriodEnd: false,
    });
  }
  const overview = publicBillingOverview(await billing.overview(owner, workspace.id));
  return renderToStaticMarkup(
    <PlanManager initialOverview={overview} initialWorkspaces={await billing.listWorkspaces(owner)} checkoutAvailable={opts.checkoutAvailable} lifetimeAvailable={false} paymentsOpen={opts.paymentsOpen} />,
  );
}

test('payments closed: the Pro button says Payments open soon, never Upgrade', async () => {
  const html = await plan('free', { checkoutAvailable: false, paymentsOpen: false });
  assert.doesNotMatch(html, /Upgrade to Pro|Buy|Subscribe/);
  assert.match(html, /disabled="">Payments open soon<\/button>/);
});

test('payments open: the Pro button says Upgrade to Pro', async () => {
  assert.match(await plan('free', { checkoutAvailable: true, paymentsOpen: true }), />Upgrade to Pro<\/button>/);
});

test('no Teams purchase path for anyone; a Teams subscriber still sees Teams, its seats and the seat editor', async () => {
  for (const id of ['free', 'pro'] as const) {
    assert.doesNotMatch(await plan(id, { checkoutAvailable: true, paymentsOpen: true }), /\$8(?!\d)|\/seat|per seat|Create team|Request paid seats|Teams founding pilot/i);
  }
  const teams = await plan('teams', { checkoutAvailable: true, paymentsOpen: true });
  assert.match(teams, /Current plan<\/span><strong>Teams<\/strong>/);
  assert.match(teams, /4 seats/);
  assert.match(teams, /Paid seats/);
  assert.doesNotMatch(teams, /Create team|Request paid seats|Teams founding pilot/);
});

test('Big Business holders get a link to the written fair-use section', async () => {
  const html = await plan('business', { checkoutAvailable: false, paymentsOpen: false });
  assert.match(html, /You have Big Business\. Paid once, no renewal\. <a href="https:\/\/unvibe\.site\/pricing#fair-use">Read its fair-use limit<\/a>/);
});

test('usage counts on the web Plan page read with thousands separators', async () => {
  assert.match(await plan('business', { checkoutAvailable: false, paymentsOpen: false }), /<strong>0 \/ 5,000<\/strong>.*<strong>0 \/ 10,000<\/strong>/s);
  assert.match(await plan('enterprise', { checkoutAvailable: false, paymentsOpen: false }), /<strong>0 \/ 1,000<\/strong>/);
});

test('the new tiers are never sold here and the call is never mentioned', async () => {
  const html = await plan('free', { checkoutAvailable: true, paymentsOpen: true });
  assert.match(html, /Enterprise · \$50 a month/);
  assert.match(html, /1,000 explanations a month/);
  assert.match(html, /5,000 explanations a month <a href="https:\/\/unvibe\.site\/pricing#fair-use">\(fair use\)<\/a> and 10,000 questions a month, one account/);
  assert.doesNotMatch(html, /unlimited|latest features|call with|contact you first|\bcalls\b/i);
});
