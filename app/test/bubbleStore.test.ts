import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { BUBBLE_COPY_VERSION } from '../src/core/bubble';
import { bubbleStore } from '../src/main/bubbleStore';

// The store's file lives in userData: this file's own folder. The store is made on first use, after this.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-bubble-store-'));
app.getPath = (): string => userData;
const FILE = path.join(userData, 'unvibe-bubble.json');

const onDisk = () => (JSON.parse(readFileSync(FILE, 'utf8')) as { choices: Array<{ item: string; on: boolean; copyVersion: string; at: string }> }).choices;

test('Quick look can only be turned on while the button is; turning the button off records Quick look off', () => {
  const store = bubbleStore();
  // Quick look first, with the button off: refused, nothing recorded.
  assert.deepEqual(store.set('preview', true, new Date('2026-11-19T10:00:00Z')), { ghost: false, preview: false });
  store.set('ghost', true, new Date('2026-11-19T10:01:00Z'));
  assert.deepEqual(store.set('preview', true, new Date('2026-11-19T10:02:00Z')), { ghost: true, preview: true });
  assert.deepEqual(store.set('ghost', false, new Date('2026-11-19T10:03:00Z')), { ghost: false, preview: false });
  // The button back on: Quick look stays off until it is ticked again.
  assert.deepEqual(store.set('ghost', true, new Date('2026-11-19T10:04:00Z')), { ghost: true, preview: false });
  assert.deepEqual(onDisk(), [
    { item: 'ghost', on: true, copyVersion: BUBBLE_COPY_VERSION, at: '2026-11-19T10:01:00.000Z' },
    { item: 'preview', on: true, copyVersion: BUBBLE_COPY_VERSION, at: '2026-11-19T10:02:00.000Z' },
    { item: 'ghost', on: false, copyVersion: BUBBLE_COPY_VERSION, at: '2026-11-19T10:03:00.000Z' },
    { item: 'preview', on: false, copyVersion: BUBBLE_COPY_VERSION, at: '2026-11-19T10:03:00.000Z' },
    { item: 'ghost', on: true, copyVersion: BUBBLE_COPY_VERSION, at: '2026-11-19T10:04:00.000Z' },
  ]);
});

test('a choice that cannot be written throws and leaves the switches as they were', () => {
  const store = bubbleStore();
  const before = store.state();
  rmSync(FILE);
  mkdirSync(FILE);
  try {
    assert.throws(() => store.set('ghost', !before.ghost));
    assert.deepEqual(store.state(), before);
  } finally {
    rmSync(FILE, { recursive: true });
  }
});
