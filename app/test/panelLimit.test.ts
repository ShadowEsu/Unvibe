import test from 'node:test';
import assert from 'node:assert/strict';
import { limitState, showsLimit } from '../src/renderer/widget/panelModel';

const resetsAt = '2026-11-28T12:00:00.000Z';
const longDate = new Date(resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

test('the limit says how many explanations were used, from the usage event, and when they come back', () => {
  for (const limit of [30, 50]) {
    for (const plan of ['free', 'local', 'pro', 'teams', undefined]) {
      const state = limitState({ plan, limit, resetsAt }, false);
      assert.ok(state.title.includes(String(limit)), `${plan}: ${state.title}`);
      assert.ok(state.when.includes(longDate), `${plan}: ${state.when}`);
    }
  }
});

test('the public-beta trial names its 30-day allowance and when the 30 days end, never a refill date', () => {
  const state = limitState({ plan: 'trial', limit: 30, resetsAt }, false);
  assert.match(state.title, /30-day/);
  assert.ok(state.when.includes(longDate), 'the end date');
  assert.doesNotMatch(state.when, /refill on/, 'the trial allowance does not refill');
  assert.ok(limitState({ plan: 'trial', limit: 30, resetsAt: 'not-a-date' }, false).when.length > 0, 'an unusable date still says what to do');
});

test('while Pro is closed the limit offers no Pro link (no button that leads nowhere); the survey is a text link', () => {
  for (const plan of ['free', 'local', 'trial', undefined]) {
    assert.deepEqual(limitState({ plan, limit: 30, resetsAt }, false).links, ['survey'], String(plan));
    assert.deepEqual(limitState({ plan, limit: 30, resetsAt }, true).links, ['survey', 'plan'], String(plan));
  }
  assert.deepEqual(limitState({ plan: 'pro', limit: 300, resetsAt }, false).links, ['plan'], 'a paid plan manages billing on Plan');
});

test('the limit state replaces the content only where there is nothing else to show', () => {
  assert.equal(showsLimit('error', 'plan_limit_reached', false), true, 'main reported the limit');
  assert.equal(showsLimit('error', 'plan_limit_reached', true), true);
  assert.equal(showsLimit('boot', '', true), true, 'panel opened at zero with nothing captured');
  assert.equal(showsLimit('empty', '', true), true);
  assert.equal(showsLimit('done', '', true), false, 'the last explanation stays on screen');
  assert.equal(showsLimit('streaming', '', true), false, 'an explanation through your own key keeps streaming');
  assert.equal(showsLimit('ready', '', true), false, 'main decides once the code is captured');
  assert.equal(showsLimit('error', '', false), false, 'other errors keep their own message');
  assert.equal(showsLimit('boot', '', false), false);
});
