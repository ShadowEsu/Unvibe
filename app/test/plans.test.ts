import assert from 'node:assert/strict';
import test from 'node:test';
import { allowanceUsedUp, asPlanId, isPaidPlan, isProPlan, limitReachedMessage, planLabel } from '../src/core/plans';

const RESETS = '2026-11-01T00:00:00.000Z';

test('known plans keep their names; the new tiers read Enterprise and Big Business', () => {
  assert.equal(planLabel('free'), 'Free');
  assert.equal(planLabel('local'), 'Free');
  assert.equal(planLabel('trial'), 'Free');
  assert.equal(planLabel(undefined), 'Free', 'nothing loaded yet');
  assert.equal(planLabel('pro'), 'Pro');
  assert.equal(planLabel('teams'), 'Teams');
  assert.equal(planLabel('full'), 'Full access');
  assert.equal(planLabel('enterprise'), 'Enterprise');
  assert.equal(planLabel('business'), 'Big Business');
});

test('an unknown plan id shows "Paid plan", never Free', () => {
  for (const plan of ['platinum', 'PRO', 'constructor', 'toString', 'enterprise ']) {
    assert.equal(asPlanId(plan), 'paid', plan);
    assert.equal(planLabel(plan), 'Paid plan', plan);
    assert.equal(isPaidPlan(plan), true, plan);
  }
});

test('Enterprise and Big Business get every Pro feature', () => {
  for (const plan of ['pro', 'teams', 'enterprise', 'business', 'full']) assert.equal(isProPlan(plan), true, plan);
  for (const plan of ['free', 'local', 'trial', undefined, 'platinum']) assert.equal(isProPlan(plan), false, String(plan));
});

test('paid plans are the billed ones', () => {
  for (const plan of ['pro', 'teams', 'enterprise', 'business']) assert.equal(isPaidPlan(plan), true, plan);
  for (const plan of ['free', 'local', 'trial', 'full', undefined]) assert.equal(isPaidPlan(plan), false, String(plan));
});

test('the limit message names the plan and never offers a purchase', () => {
  const resets = new Date(RESETS).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const pro = limitReachedMessage({ plan: 'pro', limit: 200, resetsAt: RESETS });
  assert.equal(pro, `You have reached your monthly Pro explanation limit (200). Resets on ${resets}. Add your own API key in Settings → AI to keep going.`);
  const free = limitReachedMessage({ plan: 'free', limit: 50, resetsAt: RESETS });
  assert.equal(free, `You have reached your monthly Free explanation limit (50). Resets on ${resets}. Add your own API key in Settings → AI to keep going.`);
  const trial = limitReachedMessage({ plan: 'trial', limit: 50, resetsAt: RESETS });
  assert.equal(
    trial,
    `You have reached your 30-day Free explanation limit (50). Free explanations on this computer end on ${resets}. Sign in to keep going (a new account's first month is Pro), or add your own API key in Settings → AI.`,
  );
  const enterprise = limitReachedMessage({ plan: 'enterprise', limit: 1000, resetsAt: RESETS });
  assert.equal(enterprise, `You have reached your monthly Enterprise explanation limit (1,000). Resets on ${resets}. Add your own API key in Settings → AI to keep going.`);
  const unknown = limitReachedMessage({ plan: 'platinum', limit: 300, resetsAt: RESETS });
  assert.doesNotMatch(unknown, /Free/);
  const business = limitReachedMessage({ plan: 'business', limit: null, resetsAt: RESETS });
  assert.equal(business, 'Explanations are paused for a moment by the fair-use rate limit against automated abuse. Try again in a few minutes. The fair-use rate limit is at https://unvibe.site/pricing#fair-use.');
  assert.equal(limitReachedMessage({ plan: 'business', limit: 5000, resetsAt: RESETS }), business, 'never a monthly cap, even from an older server');
  assert.doesNotMatch(business, /contact you|month|5,000/);
  for (const message of [pro, free, trial, enterprise, unknown, business]) {
    assert.doesNotMatch(message, /upgrade|buy|subscribe|requests?\b|calls?\b|unlimited/i);
  }
});

test('only a numeric allowance can be used up; an unlimited one (remaining null) never reads as 0', () => {
  assert.equal(allowanceUsedUp({ remaining: null }), false);
  assert.equal(allowanceUsedUp({ remaining: 0 }), true);
  assert.equal(allowanceUsedUp({ remaining: -1 }), true);
  assert.equal(allowanceUsedUp({ remaining: 3 }), false);
});
