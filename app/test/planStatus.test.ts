import assert from 'node:assert/strict';
import test from 'node:test';
import { FREE_LINE, freePlanLine, giftStatusLine, paidStatusLine, PRO_PITCH, proCard, resetLabel, tierStatusLine } from '../src/renderer/shared/planStatus';
import { limitOfferCopy } from '../src/renderer/shared/limitOffer';

const NOW = Date.parse('2026-10-22T12:00:00.000Z');
const END = '2026-11-21T12:00:00.000Z';

test('a canceled paid plan says when it ends and how to keep it', () => {
  const line = paidStatusLine({ status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: END }, 'Pro', NOW);
  assert.ok(line);
  assert.match(line, /^Pro ends on /);
  assert.match(line, /\(30 days left\)/);
  assert.match(line, /Manage billing/);
});

test('a failed payment names the risk and the one fix, even when also canceling', () => {
  for (const cancelAtPeriodEnd of [false, true]) {
    const line = paidStatusLine({ status: 'grace_period', cancelAtPeriodEnd, currentPeriodEnd: END }, 'Pro', NOW);
    assert.ok(line);
    assert.match(line, /payment/i);
    assert.match(line, /Update your card in Manage billing to keep Pro/);
  }
});

test('a renewing paid plan has no special status line', () => {
  assert.equal(paidStatusLine({ status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: END }, 'Pro', NOW), null);
  // Cancel without a known end date cannot promise a date.
  assert.equal(paidStatusLine({ status: 'active', cancelAtPeriodEnd: true }, 'Pro', NOW), null);
});

test('the public-beta trial ends while paid and free plans reset', () => {
  assert.match(resetLabel(END, 'trial', NOW), / end on .+ \(30 days left\)$/);
  assert.match(resetLabel(END, 'free', NOW), /^Usage limits reset on .+ \(30 days left\)$/);
  assert.match(resetLabel('2026-10-23T12:00:00.000Z', 'pro', NOW), /\(1 day left\)$/);
});

test('a gifted Pro says when it ends and that nothing is charged after', () => {
  const line = giftStatusLine(END, NOW);
  const date = new Date(END).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  assert.equal(line, `Pro from a gift until ${date}. Then you move to Free, and nothing is charged.`);
});

test('a gifted Pro with no usable end date shows no date', () => {
  for (const end of [undefined, '', 'not-a-date', '2026-10-21T12:00:00.000Z']) {
    const line = giftStatusLine(end, NOW);
    assert.equal(line, 'Pro from a gift. When it ends you move to Free, and nothing is charged.');
    assert.doesNotMatch(line, /Invalid Date|NaN/);
  }
});

test('while Pro is closed the card has no price or terms, only the Free plan\'s real allowance', () => {
  const free = { plan: 'free', limit: 50, remaining: 12, resetsAt: END };
  for (const interval of ['monthly', 'annual'] as const) {
    const card = proCard(false, interval, free, NOW);
    assert.equal(card.open, false);
    if (card.open) continue;
    assert.doesNotMatch(card.line, /\$|renews|Stripe|Sign in to upgrade/);
    assert.match(card.line, /12 of 50/);
    assert.ok(card.line.includes(new Date(END).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })), 'the refill date');
  }
  const trial = proCard(false, 'monthly', { plan: 'trial', limit: 50, remaining: 49, resetsAt: END }, NOW);
  assert.equal(trial.open, false);
  if (!trial.open) assert.match(trial.line, /49 of 50/);
  const unknown = proCard(false, 'monthly', null, NOW);
  assert.equal(unknown.open, false);
  if (!unknown.open) assert.doesNotMatch(unknown.line, /\$|undefined|NaN/);
});

test('once Pro is open the card keeps the price and renewal terms for the chosen interval', () => {
  assert.deepEqual(proCard(true, 'monthly', null, NOW), { open: true, price: '$9/mo', terms: 'Pro renews at $9 per month until canceled.' });
  assert.deepEqual(proCard(true, 'annual', null, NOW), { open: true, price: '$81/yr', terms: 'Pro renews at $81 per year until canceled.' });
});

test('the Pro card promises 200 explanations each month', () => {
  assert.equal(PRO_PITCH, 'Unlock git diffs, nearby files, and 200 explanations each month.');
});

test('Enterprise and Big Business holders get a status line with no price, upgrade, calls or bare unlimited', () => {
  const enterprise = tierStatusLine('enterprise', { plan: 'enterprise', limit: 1000, remaining: 400, resetsAt: END });
  const refill = new Date(END).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  assert.equal(enterprise, `Enterprise includes 1,000 explanations a month. They refill on ${refill}.`);
  const business = tierStatusLine('business', { plan: 'business', limit: 5000, remaining: 5000, resetsAt: END });
  assert.ok(business);
  assert.match(business, /^Big Business is paid once and doesn't renew\./);
  assert.match(business, /written fair-use limit of 5,000 explanations a month/);
  assert.match(business, /we contact you first/);
  for (const line of [enterprise, business, tierStatusLine('business', null), tierStatusLine('enterprise', null)]) {
    assert.ok(line);
    assert.doesNotMatch(line, /\$|upgrade|buy|subscribe|calls?\b|unlimited|undefined|NaN/i);
  }
  for (const plan of ['free', 'pro', 'teams', 'trial', 'local', 'full', 'mystery']) {
    assert.equal(tierStatusLine(plan, null), null, plan);
  }
});

test('where Free is described it is the settled sentence, after the welcome month', () => {
  assert.equal(FREE_LINE, 'Free: 50 explanations a month with a free account (50 in your first 30 days without one)');
  assert.equal(freePlanLine(null, NOW), `Pro isn't open yet. ${FREE_LINE}.`);
  const ended = freePlanLine({ plan: 'trial', limit: 50, remaining: 0, resetsAt: '2026-10-01T12:00:00.000Z' }, NOW);
  const trialOffer = limitOfferCopy('trial', { used: 50, limit: 50, resetsAt: END }, false);
  for (const line of [ended, trialOffer.body]) {
    assert.ok(line.includes(`Sign in to keep going: a new account's first month is Pro. ${FREE_LINE}.`), line);
    assert.doesNotMatch(line, /refills every month|50\/month|requests?\b|calls?\b/);
  }
});
