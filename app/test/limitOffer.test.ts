import assert from 'node:assert/strict';
import test from 'node:test';
import { limitOfferCopy } from '../src/renderer/shared/limitOffer';

const usage = { used: 30, limit: 30, resetsAt: '2026-09-01T00:00:00.000Z' };

test('trial beta copy pauses the session for a survey', () => {
  const copy = limitOfferCopy('trial', usage);
  assert.equal(copy.title, 'Session paused');
  assert.match(copy.body, /1 week of Pro/);
  assert.equal(copy.primaryKind, 'survey');
  assert.equal(copy.showPlan, true);
});

test('local beta copy matches trial', () => {
  const copy = limitOfferCopy('local', usage);
  assert.equal(copy.primaryKind, 'survey');
  assert.equal(copy.title, 'Session paused');
});

test('free copy matches trial survey and Plan offer', () => {
  const copy = limitOfferCopy('free', usage);
  assert.equal(copy.title, 'Session paused');
  assert.equal(copy.primaryKind, 'survey');
  assert.equal(copy.showPlan, true);
});

test('pro copy does not sell the survey deal', () => {
  const copy = limitOfferCopy('pro', usage);
  assert.equal(copy.primaryKind, 'plan');
  assert.equal(copy.showPlan, false);
  assert.match(copy.body, /refill/);
});
