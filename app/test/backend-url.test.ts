import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendUrl } from '../src/main/backend';

test('uses the documented web development port by default', () => {
  assert.equal(resolveBackendUrl({}), 'http://localhost:8787');
});

test('respects an explicit backend override', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'https://staging.example.test' }), 'https://staging.example.test');
});

test('a packaged backend cannot be overridden at runtime', () => {
  assert.equal(
    resolveBackendUrl({ UNVIBE_BACKEND: 'http://localhost:8787' }, 'https://approved-staging.example.test'),
    'https://approved-staging.example.test',
  );
});
