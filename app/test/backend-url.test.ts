import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendUrl } from '../src/main/backend';

test('uses the documented web development port by default', () => {
  assert.equal(resolveBackendUrl({}), 'http://localhost:8787');
});

test('respects an explicit backend override', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'https://staging.example.test' }), 'https://staging.example.test');
});

test('a non-local runtime backend overrides a packaged bake', () => {
  assert.equal(
    resolveBackendUrl({ UNVIBE_BACKEND: 'https://custom.example.test' }, 'https://approved-staging.example.test'),
    'https://custom.example.test',
  );
});

test('packaged bake ignores a stale localhost Application Support override', () => {
  assert.equal(
    resolveBackendUrl({ UNVIBE_BACKEND: 'http://localhost:8788' }, 'https://unvibe-api.vercel.app'),
    'https://unvibe-api.vercel.app',
  );
});

test('packaged bake is used when no runtime override is set', () => {
  assert.equal(
    resolveBackendUrl({}, 'https://approved-staging.example.test'),
    'https://approved-staging.example.test',
  );
});
