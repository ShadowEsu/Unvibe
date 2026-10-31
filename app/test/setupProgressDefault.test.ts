import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from './electronStub';

// An install from before this release: settings were saved whole, so `shareSetupProgress: true`
// is on disk although the person never chose it. This file gets its own userData.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-setup-progress-'));
app.getPath = (): string => userData;
const file = path.join(userData, 'unvibe-settings.json');
writeFileSync(file, JSON.stringify({ settingsRevision: 8, onboarded: true, shareSetupProgress: true, shortcut: 'Control+U' }));

import { settings } from '../src/main/settings';

test('setup progress is off for an existing install that never chose it, and the switch is saved', () => {
  assert.equal(settings().all().shareSetupProgress, false);
  const saved = JSON.parse(readFileSync(file, 'utf8')) as { shareSetupProgress: boolean; setupProgressRevision: number; onboarded: boolean };
  assert.equal(saved.shareSetupProgress, false);
  assert.equal(saved.setupProgressRevision, 1);
  // Nothing else about the install changes.
  assert.equal(saved.onboarded, true);
});

test('once migrated, turning it on is kept: the saved revision stops it being reset again', () => {
  settings().set({ shareSetupProgress: true });
  const saved = JSON.parse(readFileSync(file, 'utf8')) as { shareSetupProgress: boolean; setupProgressRevision: number };
  assert.equal(saved.shareSetupProgress, true);
  assert.equal(saved.setupProgressRevision, 1);
});
