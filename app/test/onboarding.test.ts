import test from 'node:test';
import assert from 'node:assert/strict';
import { firstNameOf, forwardAction, onboardingSteps, setupFooter, vibeLine, welcomeBackLine, type OnboardingState, type ShortcutOffer } from '../src/renderer/companion/onboardingFlow';

/** Every state first run can be in, on both systems. */
function allStates(): OnboardingState[] {
  const out: OnboardingState[] = [];
  for (const windows of [false, true]) {
    for (let step = 0; step < onboardingSteps(windows).length; step++) {
      for (const firstName of ['', firstNameOf('  Mary Ann  Smith-Jones ')]) {
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

test('Vibe says 8 words or fewer on every step and state, whatever name was typed', () => {
  for (const s of allStates()) assert.ok(words(vibeLine(s)) <= 8, `${JSON.stringify(s)}: "${vibeLine(s)}"`);
  for (const started of [false, true]) assert.ok(words(welcomeBackLine(started)) <= 8);
  assert.equal(vibeLine({ ...allStates()[0]!, step: 0 }), "Hey! I'm Vibe. I explain your AI's code.");
});

test('the greeting uses only the first word of the typed name, and none when it is blank', () => {
  assert.equal(firstNameOf('  Mary Ann  Smith-Jones '), 'Mary');
  assert.equal(firstNameOf('   '), '');
  const tryIt = (displayName: string) => vibeLine({ ...allStates()[0]!, step: 1, firstName: firstNameOf(displayName) });
  assert.equal(tryIt('Mary Ann Smith'), 'Nice to meet you, Mary. Let\'s try one.');
  assert.equal(tryIt(''), "Let's do one for real.");
});

test('every state has exactly one primary, in the footer, and the quiet action is never also the primary', () => {
  for (const s of allStates()) {
    const f = setupFooter(s);
    assert.ok(f.primary, `${JSON.stringify(s)}: no primary`);
    assert.notEqual(f.quiet?.label, f.primary, JSON.stringify(s));
    // Held only while a paste is in the panel and its explanation hasn't landed.
    assert.equal(f.held, s.step === 2 && s.pasteStarted && !s.ownCodeDone, JSON.stringify(s));
  }
});

test('the footer matches the 633 table: quiet left, primary right, the step action wins over the forward move', () => {
  const base: OnboardingState = { step: 0, windows: false, firstName: '', explained: false, pasteStarted: false, ownCodeDone: false, offer: 'offer' };
  const row = (s: Partial<OnboardingState>) => {
    const f = setupFooter({ ...base, ...s });
    return [f.quiet?.label ?? null, f.primary, f.primaryIsStep, f.held];
  };
  assert.deepEqual(row({ step: 0 }), [null, "Let's go", false, false]);
  assert.deepEqual(row({ step: 1 }), ['Skip for now', 'Explain this code', true, false]);
  assert.deepEqual(row({ step: 1, explained: true }), [null, 'Next', false, false]);
  assert.deepEqual(row({ step: 2 }), ['Skip for now', 'Explain my clipboard', true, false]);
  assert.deepEqual(row({ step: 2, pasteStarted: true }), ['Skip for now', 'Next', false, true]);
  assert.deepEqual(row({ step: 2, ownCodeDone: true }), [null, 'Next', false, false]);
  assert.deepEqual(row({ step: 2, windows: true, ownCodeDone: true }), [null, 'Start using Unvibe', false, false]);
  assert.deepEqual(row({ step: 3 }), ['Not now', 'Turn on the shortcut', true, false]);
  assert.deepEqual(row({ step: 3, offer: 'waiting' }), ['Do it later', 'Open System Settings', true, false]);
  assert.deepEqual(row({ step: 3, offer: 'on' }), [null, 'Start using Unvibe', false, false]);
  // The quiet ways out on the paste and shortcut steps finish setup; Skip on Try it moves on.
  assert.equal(setupFooter({ ...base, step: 2, pasteStarted: true }).quiet?.finishes, true);
  assert.equal(setupFooter({ ...base, step: 1 }).quiet?.finishes, undefined);
});

test('the last step finishes setup; quiet ways out finish it too, and Next never skips the shortcut on a Mac', () => {
  const base = allStates()[0]!;
  assert.deepEqual(forwardAction({ ...base, step: 2, windows: true, ownCodeDone: true }), { label: 'Start using Unvibe', finishes: true });
  assert.deepEqual(forwardAction({ ...base, step: 2, windows: false, ownCodeDone: true }), { label: 'Next' });
  assert.equal(forwardAction({ ...base, step: 2, ownCodeDone: false }).finishes, true);
  assert.equal(forwardAction({ ...base, step: 3, offer: 'waiting' }).label, 'Do it later');
  assert.deepEqual(forwardAction({ ...base, step: 3, offer: 'on' }), { label: 'Start using Unvibe', finishes: true });
});
