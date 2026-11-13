import test from 'node:test';
import assert from 'node:assert/strict';
import { accessibilityRow } from '../src/renderer/companion/settingsRows';

test('a Mac shows Allowed once granted, and offers Allow Accessibility only while it is not', () => {
  assert.deepEqual(accessibilityRow({ granted: true, platform: 'darwin' }), { label: 'Allowed', tone: 'ok', canAllow: false });
  assert.deepEqual(accessibilityRow({ granted: false, platform: 'darwin' }), { label: 'Not allowed yet', tone: 'no', canAllow: true });
});

test('Windows has nothing to allow, whatever main says about the grant', () => {
  for (const granted of [true, false]) {
    assert.deepEqual(accessibilityRow({ granted, platform: 'win32' }), { label: 'Not needed', tone: 'na', canAllow: false });
  }
});

test('before main answers there is no status and no button, so a Mac never flashes "Not needed"', () => {
  assert.deepEqual(accessibilityRow(null), { label: null, tone: null, canAllow: false });
});
