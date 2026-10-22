import assert from 'node:assert/strict';
import test from 'node:test';
import { explanationFailure } from '../src/core/serviceError';

test('an older service\'s 402 quota_exceeded is a plan message with the Plan offer, not "(402)"', () => {
  const withMessage = explanationFailure(402, { error: 'quota_exceeded', message: 'You\'ve used all 30 free code explanations included in the beta.' });
  assert.deepEqual(withMessage, { message: 'You\'ve used all 30 free code explanations included in the beta.', planLimit: true });
  const bare = explanationFailure(402, {});
  assert.equal(bare.planLimit, true);
  assert.doesNotMatch(bare.message, /402/);
  assert.match(bare.message, /Plan & usage/);
});

test('the current 429 plan_limit_reached keeps the server\'s reset message', () => {
  const failure = explanationFailure(429, { error: 'plan_limit_reached', message: 'You have reached your monthly explanations limit (100).' });
  assert.deepEqual(failure, { message: 'You have reached your monthly explanations limit (100).', planLimit: true });
});

test('a plan check outage explains itself instead of showing "(503)"', () => {
  const failure = explanationFailure(503, { error: 'entitlements_unavailable', message: 'We could not verify your plan safely. Try again shortly.' });
  assert.deepEqual(failure, { message: 'We could not verify your plan safely. Try again shortly.', planLimit: false });
  assert.doesNotMatch(explanationFailure(500, {}).message, /500/);
});

test('signed-out and unexpected statuses keep their existing wording', () => {
  assert.equal(explanationFailure(401, { error: 'unauthorized' }).message, 'Sign in to use cloud explanations, or continue with local learning history.');
  assert.deepEqual(explanationFailure(413, { error: 'too big' }), { message: 'The explanation service could not complete that request (413).', planLimit: false });
});
