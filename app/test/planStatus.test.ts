import assert from 'node:assert/strict';
import test from 'node:test';
import { paidStatusLine, resetLabel } from '../src/renderer/shared/planStatus';

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

test('free beta ends while paid and free plans reset', () => {
  assert.match(resetLabel(END, 'trial', NOW), /^Free beta ends on .+ \(30 days left\)$/);
  assert.match(resetLabel(END, 'free', NOW), /^Usage limits reset on .+ \(30 days left\)$/);
  assert.match(resetLabel('2026-10-23T12:00:00.000Z', 'pro', NOW), /\(1 day left\)$/);
});
