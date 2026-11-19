import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from './electronStub';

// An install from before overlay B: the panel dimmed to a chosen opacity. This file gets its own userData.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-click-away-'));
app.getPath = (): string => userData;
const file = path.join(userData, 'unvibe-settings.json');
writeFileSync(file, JSON.stringify({ settingsRevision: 8, onboarded: true, inactiveBehavior: 'dim', widgetOpacityInactive: 0.5, theme: 'light', appearanceRevision: 2 }));

import { settings } from '../src/main/settings';

test('the old Dim and opacity slider become Fade, and the slider is gone from disk', () => {
  assert.equal(settings().all().inactiveBehavior, 'fade');
  const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  assert.equal(saved.inactiveBehavior, 'fade');
  assert.ok(!('widgetOpacityInactive' in saved));
  assert.ok(!('themeChosen' in saved), 'the migration chose no theme');
});

test('Settings takes only Fade or Hide, and choosing a theme is remembered as a choice', () => {
  settings().set({ inactiveBehavior: 'hide' });
  assert.equal(settings().all().inactiveBehavior, 'hide');
  settings().set({ inactiveBehavior: 'dim' as never });
  assert.equal(settings().all().inactiveBehavior, 'hide');
  settings().set({ theme: 'light' });
  assert.equal(settings().all().themeChosen, true);
});
