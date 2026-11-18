import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from './electronStub';

// An install from before Density: its settings file has no density. This file gets its own userData.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-density-'));
app.getPath = (): string => userData;
const file = path.join(userData, 'unvibe-settings.json');
writeFileSync(file, JSON.stringify({ settingsRevision: 8, onboarded: true, theme: 'light', appearanceRevision: 2 }));

import { settings } from '../src/main/settings';

test('an install without a density choice is Comfortable', () => {
  assert.equal(settings().all().density, 'comfortable');
});

test('Settings takes Compact and Comfortable, and saves the choice', () => {
  settings().set({ density: 'compact' });
  assert.equal(settings().all().density, 'compact');
  const saved: unknown = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(saved && typeof saved === 'object' && 'density' in saved);
  assert.equal(saved.density, 'compact');
  settings().set({ density: 'comfortable' });
  assert.equal(settings().all().density, 'comfortable');
});

test('anything else keeps the current density', () => {
  settings().set({ density: 'compact' });
  for (const bad of ['dense', '', 'COMPACT', 1, null] as unknown[]) {
    settings().set({ density: bad as never });
    assert.equal(settings().all().density, 'compact');
  }
  // A patch without density leaves it alone.
  settings().set({ soundEffects: false });
  assert.equal(settings().all().density, 'compact');
});
