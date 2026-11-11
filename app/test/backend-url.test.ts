import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendUrl } from '../src/main/backendUrl';

test('uses the documented web development port by default', () => {
  assert.equal(resolveBackendUrl({}), 'http://localhost:8787');
});

test('respects an explicit backend override', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'https://staging.example.test' }), 'https://staging.example.test');
});

test('a development build with a baked backend still takes a non-local override', () => {
  assert.equal(
    resolveBackendUrl({ UNVIBE_BACKEND: 'https://custom.example.test' }, 'https://approved-staging.example.test'),
    'https://custom.example.test',
  );
});

test('a development build with a baked backend ignores a stale localhost override', () => {
  assert.equal(
    resolveBackendUrl({ UNVIBE_BACKEND: 'http://localhost:8788' }, 'https://unvibe-api.vercel.app'),
    'https://unvibe-api.vercel.app',
  );
});

test('a packaged app sends its tokens only to the backend it was built for, whatever UNVIBE_BACKEND says', () => {
  for (const override of ['https://attacker.example.test', 'http://localhost:8788', ' https://custom.example.test ']) {
    assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: override }, 'https://api.unvibe.site', true), 'https://api.unvibe.site');
  }
  assert.equal(resolveBackendUrl({}, 'https://api.unvibe.site', true), 'https://api.unvibe.site');
});

test('a packaged app built without a backend never takes one from the environment', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'https://attacker.example.test' }, '', true), 'http://localhost:8787');
});
