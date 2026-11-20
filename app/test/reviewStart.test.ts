import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewCapture } from '../src/core/consent';
import { pulseThenUsage, restoresOpenPanel } from '../src/main/selection';
import { settlesOnClose } from '../src/main/notify';

// startReview's first decisions in order: what the capture returns, then whether the open panel is only brought back.
async function start(agreed: boolean, panel: { open: boolean; hasCode: boolean }, read: () => Promise<{ code: string | null }>) {
  const capture = await reviewCapture({}, agreed, read);
  return restoresOpenPanel({ code: capture.code, agreed, needsGrant: false, panelOpen: panel.open, panelHasCode: panel.hasCode });
}
const sampleStillShowing = { open: true, hasCode: true };
const neverRead = async (): Promise<{ code: string | null }> => { throw new Error('read before the agreement'); };

test('setup step 3: pasting your own code before the agreement opens the agreement, even with the sample still in the panel', async () => {
  // 0.1.52: the empty pre-agreement capture counted as "nothing newly selected", so the panel only came back on the
  // sample and the paste was dropped.
  assert.equal(await start(false, sampleStillShowing, neverRead), false);
});

test('after the agreement, the shortcut with nothing selected brings the open panel back as it was', async () => {
  assert.equal(await start(true, sampleStillShowing, async () => ({ code: null })), true);
});

test('a real selection always starts a new explanation, and an empty panel is never "restored"', async () => {
  assert.equal(await start(true, sampleStillShowing, async () => ({ code: 'const x = 1;' })), false);
  assert.equal(await start(true, { open: true, hasCode: false }, async () => ({ code: null })), false);
  assert.equal(await start(true, { open: false, hasCode: true }, async () => ({ code: null })), false);
});

test('a missing Mac Accessibility grant is shown, not restored over', () => {
  assert.equal(restoresOpenPanel({ code: null, agreed: true, needsGrant: true, panelOpen: true, panelHasCode: true }), false);
});

test('⌃U: the Island says Reading at once, before the usage round trip ends; never before the agreement', async () => {
  // The usage call never answers here, as a 20 s billing call past the 60 s cache would feel (lead review, #374).
  const pulses = (start: { agreed: boolean; sample?: boolean }) => {
    let pulsed = 0;
    void pulseThenUsage(start, () => { pulsed += 1; }, () => new Promise<never>(() => {}));
    return pulsed;
  };
  assert.equal(pulses({ agreed: true }), 1);
  // Security SHOULD-372c: before the agreement nothing is read, so no Reading over the agreement (or after Not now).
  assert.equal(pulses({ agreed: false }), 0);
  // The first-run sample is Unvibe's own code and runs without the agreement (CC-6).
  assert.equal(pulses({ agreed: false, sample: true }), 1);
  // The usage still comes through for the rest of the start.
  assert.equal(await pulseThenUsage({ agreed: true }, () => {}, async () => 7), 7);
});

test('closing the panel settles the Island only while it says Reading, Checking or Writing', () => {
  for (const phase of ['loading', 'working', 'contextualizing', 'searching', 'analyzing', 'thinking', 'generating', 'finalizing'] as const) {
    assert.equal(settlesOnClose(phase), true, phase);
  }
  // A finished tick, an Issue or Offline mark clear themselves; idle is already idle.
  for (const phase of ['idle', 'ready', 'understood', 'error', 'offline'] as const) {
    assert.equal(settlesOnClose(phase), false, phase);
  }
});
