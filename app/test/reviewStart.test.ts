import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewCapture } from '../src/core/consent';
import { readsOnStart, restoresOpenPanel } from '../src/main/selection';

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

test('the Island says Reading only when something is read: never before the agreement, always for the sample', () => {
  // Security SHOULD-372c: ⌃U before the agreement opened the agreement while the Island said Reading, and kept saying it
  // after Not now.
  assert.equal(readsOnStart({ agreed: false }), false);
  assert.equal(readsOnStart({ agreed: true }), true);
  // The first-run sample is Unvibe's own code and runs without the agreement (CC-6).
  assert.equal(readsOnStart({ agreed: false, sample: true }), true);
});
