import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendUrl } from '../src/main/backendUrl';

test('a development build uses the documented web development port by default', () => {
  assert.equal(resolveBackendUrl(false, {}, ''), 'http://localhost:8787');
});

test('a development build takes UNVIBE_BACKEND over its baked backend, local mocks included', () => {
  assert.equal(resolveBackendUrl(false, { UNVIBE_BACKEND: 'https://staging.example.test' }, ''), 'https://staging.example.test');
  assert.equal(resolveBackendUrl(false, { UNVIBE_BACKEND: 'http://127.0.0.1:8795' }, 'https://api.unvibe.site'), 'http://127.0.0.1:8795');
  assert.equal(resolveBackendUrl(false, {}, 'https://api.unvibe.site'), 'https://api.unvibe.site');
});

test('a packaged app sends its tokens only to the backend it was built for, whatever UNVIBE_BACKEND says', () => {
  for (const override of ['https://attacker.example.test', 'http://localhost:8788', ' https://custom.example.test ']) {
    assert.equal(resolveBackendUrl(true, { UNVIBE_BACKEND: override }, 'https://api.unvibe.site'), 'https://api.unvibe.site');
  }
  assert.equal(resolveBackendUrl(true, {}, 'https://api.unvibe.site'), 'https://api.unvibe.site');
});

test('a packaged app built without a backend never takes one from the environment', () => {
  assert.equal(resolveBackendUrl(true, { UNVIBE_BACKEND: 'https://attacker.example.test' }, ''), 'http://localhost:8787');
});
