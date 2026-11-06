import test from 'node:test';
import assert from 'node:assert/strict';
import { allowanceUsedPct } from '../src/core/allowance';

test('the share used matches what is left: 1 of 50 used is 2%, none left is 100%', () => {
  assert.equal(allowanceUsedPct({ limit: 50, remaining: 49 }), 2);
  assert.equal(allowanceUsedPct({ limit: 50, remaining: 0 }), 100);
});

test('never over 100% or under 0%, whatever the counts say', () => {
  // Own-key explanations past the limit: remaining can't go below 0, used keeps growing.
  assert.equal(allowanceUsedPct({ limit: 50, remaining: -10 }), 100);
  assert.equal(allowanceUsedPct({ limit: 50, remaining: 60 }), 0);
});

test('an expired trial (0 left, old used of 10) reads 100% used, next to "0 AI"', () => {
  assert.equal(allowanceUsedPct({ limit: 50, remaining: 0 }), 100);
});

test('no positive limit, no number', () => {
  assert.equal(allowanceUsedPct(undefined), undefined);
  assert.equal(allowanceUsedPct({ limit: 0, remaining: 0 }), undefined);
});
