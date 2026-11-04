import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendUrl } from '../src/main/backendUrl';

const BAKED = 'https://api.unvibe.site';

test('uses the documented web development port by default', () => {
  assert.equal(resolveBackendUrl({}), 'http://localhost:8787');
});

test('a development build respects an explicit backend override', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'https://staging.example.test' }), 'https://staging.example.test');
});

test('a release build ignores a remote override, https or plain http', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'https://evil.example' }, BAKED), BAKED);
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'http://evil.example' }, BAKED), BAKED);
});

test('a release build keeps its own URL when the override names it', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: BAKED }, BAKED), BAKED);
});

test('packaged bake ignores a stale localhost Application Support override', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'http://localhost:8788' }, 'https://unvibe-api.vercel.app'), 'https://unvibe-api.vercel.app');
});

test('packaged bake is used when no runtime override is set', () => {
  assert.equal(resolveBackendUrl({}, 'https://approved-staging.example.test'), 'https://approved-staging.example.test');
});

test('a release build accepts the CI mock only over https and only with UNVIBE_CI_MOCK=1', () => {
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'https://unvibe-mock.test:8787', UNVIBE_CI_MOCK: '1' }, BAKED), 'https://unvibe-mock.test:8787');
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'https://unvibe-mock.test:8787' }, BAKED), BAKED);
  assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: 'http://unvibe-mock.test:8787', UNVIBE_CI_MOCK: '1' }, BAKED), BAKED);
});

test('the CI mock entry matches the exact host, with no path, query or credentials', () => {
  for (const value of [
    'https://unvibe-mock.test.evil.example:8787',
    'https://evil.example/unvibe-mock.test',
    'https://unvibe-mock.test:8787/api',
    'https://unvibe-mock.test:8787/?x=1',
    'https://user:pw@unvibe-mock.test:8787',
    'not a url',
  ]) assert.equal(resolveBackendUrl({ UNVIBE_BACKEND: value, UNVIBE_CI_MOCK: '1' }, BAKED), BAKED, value);
});
