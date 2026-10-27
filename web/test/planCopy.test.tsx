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
  const workspace = planId === 'teams' || planId === 'business' ? await billing.createTeamWorkspace(owner, 'Team') : personal;
  if (planId !== 'free') {
    const oneTime = planId === 'business';
    await billing.syncSubscription({
      workspaceId: workspace.id, plan: planId, interval: oneTime ? 'lifetime' : 'monthly', status: 'active', seats: planId === 'teams' ? 4 : planId === 'business' ? 10 : 1,
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

test('Big Business holders read unlimited for up to 10 named seats and get a link to the fair-use rate limit', async () => {
  const html = await plan('business', { checkoutAvailable: false, paymentsOpen: false });
  assert.match(html, /You have Big Business\. Paid once, no renewal\. Unlimited explanations and questions for up to 10 named seats, with a <a href="https:\/\/unvibe\.site\/pricing#fair-use">fair-use rate limit against automated abuse<\/a>/);
});

test('usage counts on the web Plan page read with thousands separators; an unlimited line has no cap and no bar', async () => {
  const business = await plan('business', { checkoutAvailable: false, paymentsOpen: false });
  assert.match(business, /<span>ai explanation<\/span><strong>0 · Unlimited<\/strong><\/div><small>No monthly cap<\/small>/);
  assert.match(business, /<span>project question<\/span><strong>0 · Unlimited<\/strong>/);
  assert.match(business, /<strong>0 \/ 20,000<\/strong>/);
  assert.match(await plan('enterprise', { checkoutAvailable: false, paymentsOpen: false }), /<strong>0 \/ 1,000<\/strong>/);
});

test('the new tiers are never sold here and the call is never mentioned', async () => {
  const html = await plan('free', { checkoutAvailable: true, paymentsOpen: true });
  assert.match(html, /Enterprise · \$50 a month/);
  assert.match(html, /1,000 explanations a month/);
  assert.match(html, /Unlimited explanations and questions and every feature, for up to 10 named seats, paid once\. Its only limit is the <a href="https:\/\/unvibe\.site\/pricing#fair-use">fair-use rate limit against automated abuse: per person, 10 requests a minute, 60 an hour and 1 million characters an hour<\/a>\. Payments open soon\./);
  assert.doesNotMatch(html, /latest features|call with|contact you first|\bcalls\b/i);
  assert.doesNotMatch(html, /5,000 explanations|10,000 questions|fair-use limit|pause until/, 'no Big Business monthly cap is written anywhere');
});
