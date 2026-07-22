import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAY_FALLBACK_PNG_BASE64,
  trayFallbackBuffer,
  pngSize,
  isRenderablePng,
} from '../src/core/trayIcon';

test('embedded tray fallback is a non-empty base64 string', () => {
  assert.ok(TRAY_FALLBACK_PNG_BASE64.length > 100);
});

test('tray fallback decodes to a valid, renderable PNG', () => {
  const buf = trayFallbackBuffer();
  assert.ok(buf.length > 0, 'fallback buffer is empty');
  assert.ok(isRenderablePng(buf), 'fallback is not a renderable PNG');
});

test('tray fallback has non-zero, square menu-bar dimensions', () => {
  const size = pngSize(trayFallbackBuffer());
  assert.ok(size, 'could not read PNG size');
  // A macOS template tray glyph must have real dimensions or the menu-bar item is invisible.
  assert.ok(size!.width >= 16 && size!.height >= 16, 'tray glyph too small');
  assert.equal(size!.width, size!.height, 'tray glyph should be square');
});

test('pngSize rejects non-PNG and truncated buffers', () => {
  assert.equal(pngSize(Buffer.from('not a png at all')), null);
  assert.equal(pngSize(Buffer.alloc(4)), null);
  // Correct signature but truncated before IHDR dimensions.
  const almost = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(4),
  ]);
  assert.equal(pngSize(almost), null);
  assert.equal(isRenderablePng(Buffer.from('nope')), false);
});
