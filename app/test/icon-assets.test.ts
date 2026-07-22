import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// These assets are load-bearing: a missing trayTemplate.png makes the menu-bar
// item render invisibly, and a missing icon.icns leaves the packaged Dock icon
// blank. This test fails loudly if the committed source assets disappear.
// (Run from app/, where `npm test` executes.)
const BUILD = resolve(process.cwd(), 'build');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(buf: Buffer): { w: number; h: number } {
  assert.ok(buf.subarray(0, 8).equals(PNG_MAGIC), 'not a PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('app icon exists and is a 1024x1024 PNG', () => {
  const p = resolve(BUILD, 'icon.png');
  assert.ok(existsSync(p), 'build/icon.png missing');
  const { w, h } = pngSize(readFileSync(p));
  assert.equal(w, 1024);
  assert.equal(h, 1024);
});

test('menu-bar template exists at 1x and 2x', () => {
  const one = pngSize(readFileSync(resolve(BUILD, 'trayTemplate.png')));
  assert.deepEqual(one, { w: 22, h: 22 });
  const two = pngSize(readFileSync(resolve(BUILD, 'trayTemplate@2x.png')));
  assert.deepEqual(two, { w: 44, h: 44 });
});

test('icns bundle is well-formed and declares its own length', () => {
  const buf = readFileSync(resolve(BUILD, 'icon.icns'));
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'icns', 'bad icns magic');
  assert.equal(buf.readUInt32BE(4), buf.length, 'icns length header mismatch');
  // Must carry the 1024px (ic10) retina entry macOS uses for the Dock.
  assert.ok(buf.includes(Buffer.from('ic10', 'ascii')), 'icns missing ic10 entry');
});

test('entitlements plist references JIT for Electron under hardened runtime', () => {
  const xml = readFileSync(resolve(BUILD, 'entitlements.mac.plist'), 'utf8');
  assert.match(xml, /com\.apple\.security\.cs\.allow-jit/);
  assert.match(xml, /com\.apple\.security\.network\.client/);
});
