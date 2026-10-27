import assert from 'node:assert/strict';
import test from 'node:test';
import { limitOfferCopy } from '../src/renderer/shared/limitOffer';
import { refillDate } from '../src/renderer/shared/planStatus';

const usage = { used: 30, limit: 30, resetsAt: '2026-09-01T00:00:00.000Z' };
const localDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

test('trial beta copy pauses the session for a survey', () => {
  const copy = limitOfferCopy('trial', usage, true);
  assert.equal(copy.title, 'Session paused');
  assert.equal(copy.primaryKind, 'survey');
  assert.equal(copy.showPlan, true);
});

test('local beta copy matches trial', () => {
  const copy = limitOfferCopy('local', usage, true);
  assert.equal(copy.primaryKind, 'survey');
  assert.equal(copy.title, 'Session paused');
});

test('free copy matches trial survey and Plan offer', () => {
  const copy = limitOfferCopy('free', usage, true);
  assert.equal(copy.title, 'Session paused');
  assert.equal(copy.primaryKind, 'survey');
  assert.equal(copy.showPlan, true);
});

test('pro copy does not sell the survey deal', () => {
  const copy = limitOfferCopy('pro', usage, true);
  assert.equal(copy.primaryKind, 'plan');
  assert.equal(copy.showPlan, false);
  assert.match(copy.body, /refill/);
});

test('a monthly allowance refills on resetsAt as a local date, never a countdown', () => {
  for (const plan of ['free', 'local', 'pro', 'teams', undefined]) {
    assert.equal(refillDate(plan, usage.resetsAt), localDate(usage.resetsAt), String(plan));
  }
  assert.doesNotMatch(refillDate('free', usage.resetsAt) ?? '', /day|hour|left/);
});

test('the public-beta trial and an unusable date have no refill date', () => {
  assert.equal(refillDate('trial', usage.resetsAt), null, 'resetsAt is the end of the 30 days');
  assert.equal(refillDate('free', 'not-a-date'), null);
  assert.equal(refillDate('free', ''), null);
});

test('while Pro is closed a used-up Free allowance says when it refills; open copy is unchanged', () => {
  for (const plan of ['free', 'local']) {
    const closed = limitOfferCopy(plan, usage, false);
    assert.ok(closed.body.includes(localDate(usage.resetsAt)), plan);
    assert.equal(closed.primaryKind, 'survey');
    const open = limitOfferCopy(plan, usage, true);
    assert.equal(open.body.includes(localDate(usage.resetsAt)), false, plan);
  }
  const trial = limitOfferCopy('trial', usage, false);
  assert.equal(trial.body.includes(localDate(usage.resetsAt)), false, 'the trial never claims a refill date');
});

test('Enterprise, Big Business and unknown plans are paid: no survey, no Free copy, no upgrade', () => {
  for (const plan of ['enterprise', 'business', 'some-future-plan']) {
    for (const proOpen of [true, false]) {
      const copy = limitOfferCopy(plan, usage, proOpen);
      assert.equal(copy.primaryKind, 'plan', plan);
      assert.equal(copy.showPlan, false, plan);
      assert.doesNotMatch(copy.body, /Free|upgrade|survey|calls?\b/i, plan);
      assert.ok(copy.body.includes(localDate(usage.resetsAt)), plan);
    }
  }
  assert.equal(limitOfferCopy('enterprise', usage, false).title, 'Monthly limit reached');
});

test('Big Business names the fair-use limit, links it, and says we contact you first', () => {
  const copy = limitOfferCopy('business', usage, false);
  assert.equal(copy.title, 'Fair-use limit reached');
  assert.match(copy.body, /fair-use limit/);
  assert.match(copy.body, /we contact you first/);
  assert.ok(copy.body.includes('https://unvibe.site/pricing#fair-use'));
});
