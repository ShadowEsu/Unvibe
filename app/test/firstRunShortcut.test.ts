import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate as settle } from 'node:timers/promises';
import { app } from './electronStub';

// Settings live under userData; this file gets its own.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-first-run-shortcut-'));
app.getPath = (): string => userData;

import { firstRunEvent } from '../src/main/ownCodeStep';
import { settings } from '../src/main/settings';
import { turnOnShortcut, watchGrant } from '../src/renderer/shared/shortcutGuide';

/** Mocked time passed so far. */
let clock = 0;

/** Moves the mocked clock on in steps, letting each check's promise settle between them. */
async function advance(ms: number, step = 100): Promise<void> {
  for (let passed = 0; passed < ms; passed += step) {
    mock.timers.tick(step);
    clock += step;
    await settle();
  }
}

test('ownCodeDone is sent for own code while setup is open, and never for the sample', () => {
  settings().set({ onboarded: false });
  assert.equal(firstRunEvent(false), 'onboarding:ownCodeDone');
  assert.equal(firstRunEvent(true), 'onboarding:sampleDone', 'the sample only ever says sampleDone');
  // Setup finished: own code tells setup nothing (it is gone), the sample keeps its event.
  settings().set({ onboarded: true });
  assert.equal(firstRunEvent(false), null);
  assert.equal(firstRunEvent(true), 'onboarding:sampleDone');
});

test('Turn on the shortcut asks macOS first, then opens System Settings', async () => {
  const calls: string[] = [];
  // The prompt takes a turn of the event loop to answer; System Settings must wait for it.
  await turnOnShortcut({
    promptAccessibility: async () => { calls.push('promptAccessibility'); await settle(); calls.push('prompt answered'); },
    openAccessibility: async () => { calls.push('openAccessibility'); },
  });
  assert.deepEqual(calls, ['promptAccessibility', 'prompt answered', 'openAccessibility']);
});

test('a grant flip is noticed within 3 s, then the checks stop', async (t) => {
  mock.timers.enable({ apis: ['setInterval'] });
  t.after(() => mock.timers.reset());
  let granted = false;
  let checks = 0;
  let noticedAt = -1;
  watchGrant({ accessibility: async () => { checks += 1; return { granted }; } }, () => { noticedAt = clock; });
  await advance(300);
  const switchedAt = clock;
  granted = true;
  await advance(3000);
  assert.ok(noticedAt >= switchedAt && noticedAt - switchedAt <= 3000, `noticed ${noticedAt - switchedAt} ms after the switch`);
  const seen = checks;
  await advance(6000);
  assert.equal(checks, seen, 'no checks after the grant');
});

test('closing the guide stops the checks', async (t) => {
  mock.timers.enable({ apis: ['setInterval'] });
  t.after(() => mock.timers.reset());
  let checks = 0;
  let notified = false;
  const stop = watchGrant({ accessibility: async () => { checks += 1; return { granted: false }; } }, () => { notified = true; });
  await advance(4000);
  assert.equal(checks, 2, 'one check every 2 s while open');
  stop();
  await advance(10000);
  assert.equal(checks, 2, 'no checks once closed');
  assert.equal(notified, false);
});
