import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExcludedPath } from './exclusions';

test('secret files never reach the desktop app', () => {
  for (const p of ['/repo/.env', '/repo/.env.local', '/repo/credentials', '/home/a/.ssh/id_rsa', '/repo/certs/server.pem', '/repo/signing.p12']) {
    assert.equal(isExcludedPath(p), true, p);
  }
});

test('dependency and build folders are excluded on macOS and Windows paths', () => {
  assert.equal(isExcludedPath('/repo/node_modules/react/index.js'), true);
  assert.equal(isExcludedPath('C:\\repo\\node_modules\\react\\index.js'), true);
  assert.equal(isExcludedPath('C:\\repo\\.git\\config'), true);
  assert.equal(isExcludedPath('/repo/dist/app.js'), true);
});

test('ordinary source files are allowed, even when a name contains an excluded word', () => {
  for (const p of ['/repo/src/app.ts', '/repo/src/build.ts', '/repo/src/distance.py', 'C:\\repo\\src\\environment.ts']) {
    assert.equal(isExcludedPath(p), false, p);
  }
});
