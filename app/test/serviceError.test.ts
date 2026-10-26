import assert from 'node:assert/strict';
import test from 'node:test';
import { explanationFailure } from '../src/core/serviceError';

test('an older service\'s 402 quota_exceeded is a plan message with the Plan offer, not "(402)"', () => {
  const withMessage = explanationFailure(402, { error: 'quota_exceeded', message: 'You\'ve used all 30 free code explanations included in the beta.' });
  assert.deepEqual(withMessage, { message: 'You\'ve used all 30 free code explanations included in the beta.', planLimit: true, proRequired: false });
  const bare = explanationFailure(402, {});
  assert.equal(bare.planLimit, true);
  assert.doesNotMatch(bare.message, /402/);
  assert.match(bare.message, /Plan & usage/);
});

test('the current 429 plan_limit_reached keeps the server\'s reset message', () => {
  const failure = explanationFailure(429, { error: 'plan_limit_reached', message: 'You have reached your monthly explanations limit (100).' });
  assert.deepEqual(failure, { message: 'You have reached your monthly explanations limit (100).', planLimit: true, proRequired: false });
});

test('a plan check outage explains itself instead of showing "(503)"', () => {
  const failure = explanationFailure(503, { error: 'entitlements_unavailable', message: 'We could not verify your plan safely. Try again shortly.' });
  assert.deepEqual(failure, { message: 'We could not verify your plan safely. Try again shortly.', planLimit: false, proRequired: false });
  assert.doesNotMatch(explanationFailure(500, {}).message, /500/);
});

test('signed-out wording is unchanged and unexpected statuses never show a bare code', () => {
  assert.equal(explanationFailure(401, { error: 'unauthorized' }).message, 'Sign in to use cloud explanations, or continue with local learning history.');
  const unexpected = explanationFailure(400, { error: 'missing scope, level, or context' });
  assert.equal(unexpected.planLimit, false);
  assert.doesNotMatch(unexpected.message, /400/);
});

test('a too-long request (413) keeps the server\'s plain message, or explains itself without "(413)"', () => {
  const question = explanationFailure(413, { error: 'question_too_long', message: 'That question is too long. Keep it under 4,000 characters and try again.' });
  assert.deepEqual(question, { message: 'That question is too long. Keep it under 4,000 characters and try again.', planLimit: false, proRequired: false });
  const bare = explanationFailure(413, { error: 'review context exceeds the 120,000 character limit' });
  assert.equal(bare.planLimit, false);
  assert.doesNotMatch(bare.message, /413/);
  assert.match(bare.message, /too much/);
});

test('trial network and capacity limits (429) show the server\'s message with the Plan offer', () => {
  const network = explanationFailure(429, { error: 'trial_network_limit', message: 'This network has used today\'s free beta explanations.' });
  assert.deepEqual(network, { message: 'This network has used today\'s free beta explanations.', planLimit: true, proRequired: false });
});

test('a 402 pro_required is the Pro upgrade, not a used-up allowance', () => {
  const failure = explanationFailure(402, { error: 'pro_required', message: 'Git diff explanations, change briefs and since last understood compares are included with Unvibe Pro.' });
  assert.deepEqual(failure, {
    message: 'Git diff explanations, change briefs and since last understood compares are included with Unvibe Pro.',
    planLimit: false,
    proRequired: true,
  });
  const bare = explanationFailure(402, { error: 'pro_required' });
  assert.equal(bare.planLimit, false);
  assert.equal(bare.proRequired, true);
  assert.doesNotMatch(bare.message, /402/);
  assert.equal(explanationFailure(402, { error: 'quota_exceeded' }).proRequired, false, 'an older 402 stays an allowance message');
});
