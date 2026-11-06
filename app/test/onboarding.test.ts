import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardAction, onboardingSteps, stepAction, vibeLine, welcomeBackLine, type OnboardingState, type ShortcutOffer } from '../src/renderer/companion/onboardingFlow';

/** Every state first run can be in, on both systems. */
function allStates(): OnboardingState[] {
  const out: OnboardingState[] = [];
  for (const windows of [false, true]) {
    for (let step = 0; step < onboardingSteps(windows).length; step++) {
      for (const firstName of ['', 'Bartholomew']) {
        for (const explained of [false, true]) {
          for (const pasteStarted of [false, true]) {
            for (const ownCodeDone of [false, true]) {
              for (const offer of ['offer', 'waiting', 'on'] as ShortcutOffer[]) out.push({ step, windows, firstName, explained, pasteStarted, ownCodeDone, offer });
            }
          }
        }
      }
    }
  }
  return out;
}

const words = (line: string) => line.trim().split(/\s+/).length;

test('a Mac has four steps ending on the shortcut; Windows needs no permission and has three', () => {
  assert.deepEqual(onboardingSteps(false), ['Hello', 'Try it', 'Your code', 'Shortcut']);
  assert.deepEqual(onboardingSteps(true), ['Hello', 'Try it', 'Your code']);
});

test('Vibe says 8 words or fewer on every step and state, the longest name included', () => {
  for (const s of allStates()) assert.ok(words(vibeLine(s)) <= 8, `${JSON.stringify(s)}: "${vibeLine(s)}"`);
  for (const started of [false, true]) assert.ok(words(welcomeBackLine(started)) <= 8);
  assert.equal(vibeLine({ ...allStates()[0]!, step: 0 }), "Hey! I'm Vibe. I explain your AI's code.");
});

test('each step has one primary button, except where the action is elsewhere: the paste target, System Settings', () => {
  for (const s of allStates()) {
    const primaries = (forwardAction(s).quiet ? 0 : 1) + (stepAction(s) ? 1 : 0);
    const actionElsewhere = (s.step === 2 && !s.ownCodeDone) || (s.step === 3 && s.offer === 'waiting');
    assert.equal(primaries, actionElsewhere ? 0 : 1, `${JSON.stringify(s)}: ${primaries} primaries`);
  }
});

test('the last step finishes setup; quiet ways out finish it too, and Next never skips the shortcut on a Mac', () => {
  const base = allStates()[0]!;
  assert.deepEqual(forwardAction({ ...base, step: 2, windows: true, ownCodeDone: true }), { label: 'Start using Unvibe', finishes: true });
  assert.deepEqual(forwardAction({ ...base, step: 2, windows: false, ownCodeDone: true }), { label: 'Next' });
  assert.equal(forwardAction({ ...base, step: 2, ownCodeDone: false }).finishes, true);
  assert.equal(forwardAction({ ...base, step: 3, offer: 'waiting' }).label, 'Do it later');
  assert.deepEqual(forwardAction({ ...base, step: 3, offer: 'on' }), { label: 'Start using Unvibe', finishes: true });
});
