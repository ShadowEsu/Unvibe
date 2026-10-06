import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewer, pickAsset } from '../src/core/update';

test('version comparison', () => {
  assert.equal(isNewer('0.1.30', '0.1.29'), true);
  assert.equal(isNewer('v0.2.0', '0.1.99'), true);
  assert.equal(isNewer('0.1.29', '0.1.29'), false);
  assert.equal(isNewer('0.1.9', '0.1.10'), false);
});

test('picks the right installer for the machine', () => {
  const names = ['Unvibe-0.1.30-mac-arm64.dmg', 'Unvibe-0.1.30-mac-x64.dmg', 'Unvibe-0.1.30-win-x64-setup.exe', 'Unvibe-0.1.30-win-x64-portable.exe', 'Unvibe-0.1.30-mac-arm64.dmg.blockmap'];
  assert.equal(pickAsset(names, 'darwin', 'arm64'), 'Unvibe-0.1.30-mac-arm64.dmg');
  assert.equal(pickAsset(names, 'darwin', 'x64'), 'Unvibe-0.1.30-mac-x64.dmg');
  assert.equal(pickAsset(names, 'win32', 'x64'), 'Unvibe-0.1.30-win-x64-setup.exe');
  assert.equal(pickAsset(names, 'linux', 'x64'), undefined);
});
