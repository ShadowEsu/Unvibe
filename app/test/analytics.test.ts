import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePosthogHost,
  resolvePosthogKey,
  sanitizeAnalyticsProps,
} from '../src/main/analyticsConfig';

test('resolves PostHog key from UNVIBE_POSTHOG_KEY first', () => {
  assert.equal(
    resolvePosthogKey({
      UNVIBE_POSTHOG_KEY: 'phc_desktop',
      NEXT_PUBLIC_POSTHOG_KEY: 'phc_web',
    }),
    'phc_desktop',
  );
});

test('falls back to baked release key when env is empty', () => {
  assert.equal(resolvePosthogKey({}, 'phc_baked'), 'phc_baked');
  assert.equal(resolvePosthogKey({ UNVIBE_POSTHOG_KEY: '[SENSITIVE]' }, 'phc_baked'), 'phc_baked');
});

test('normalizes PostHog host to origin', () => {
  assert.equal(
    resolvePosthogHost({ UNVIBE_POSTHOG_HOST: 'https://us.i.posthog.com/extra' }),
    'https://us.i.posthog.com',
  );
  assert.equal(resolvePosthogHost({}), 'https://us.i.posthog.com');
});

test('sanitizeAnalyticsProps drops code-like and oversized values', () => {
  const cleaned = sanitizeAnalyticsProps({
    scope: 'selection',
    level: 'beginner',
    code: 'const secret = 1',
    email: 'person@example.com',
    explanation: 'a'.repeat(200),
    lines: 12,
    signed_in: true,
  });
  assert.deepEqual(cleaned, {
    scope: 'selection',
    level: 'beginner',
    lines: 12,
    signed_in: true,
  });
});
