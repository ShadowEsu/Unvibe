import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from './electronStub';

// A settings file edited by hand (or by a future version) with a density this version doesn't know. Own userData.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-density-disk-'));
app.getPath = (): string => userData;
writeFileSync(path.join(userData, 'unvibe-settings.json'), JSON.stringify({ settingsRevision: 8, onboarded: true, density: 'huge' }));

import { settings } from '../src/main/settings';

test('a saved density this version does not know loads as Comfortable', () => {
  assert.equal(settings().all().density, 'comfortable');
});
