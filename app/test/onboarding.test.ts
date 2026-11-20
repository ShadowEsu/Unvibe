import test from 'node:test';
import assert from 'node:assert/strict';
import { firstNameOf, forwardAction, onboardingSteps, primaryPress, setupFooter, vibeLine, welcomeBackLine, type OnboardingState, type ShortcutOffer } from '../src/renderer/companion/onboardingFlow';

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

test('the footer matches the 633 table: quiet left, primary right, and the action the primary runs', () => {
  const base: OnboardingState = { step: 0, windows: false, firstName: '', explained: false, pasteStarted: false, ownCodeDone: false, offer: 'offer' };
  const row = (s: Partial<OnboardingState>) => {
    const f = setupFooter({ ...base, ...s });
    return [f.quiet?.label ?? null, f.primary, f.action, f.held];
  };
  assert.deepEqual(row({ step: 0 }), [null, "Let's go", 'forward', false]);
  assert.deepEqual(row({ step: 1 }), ['Skip for now', 'Explain this code', 'explainSample', false]);
  assert.deepEqual(row({ step: 1, explained: true }), [null, 'Next', 'forward', false]);
  assert.deepEqual(row({ step: 2 }), ['Skip for now', 'Explain my clipboard', 'explainClipboard', false]);
  assert.deepEqual(row({ step: 2, pasteStarted: true }), ['Skip for now', 'Next', 'forward', true]);
  assert.deepEqual(row({ step: 2, ownCodeDone: true }), [null, 'Next', 'forward', false]);
  assert.deepEqual(row({ step: 2, windows: true, ownCodeDone: true }), [null, 'Start using Unvibe', 'forward', false]);
  assert.deepEqual(row({ step: 3 }), ['Not now', 'Turn on the shortcut', 'turnOn', false]);
  assert.deepEqual(row({ step: 3, offer: 'waiting' }), ['Do it later', 'Open System Settings', 'openSettings', false]);
  assert.deepEqual(row({ step: 3, offer: 'on' }), [null, 'Start using Unvibe', 'forward', false]);
  // The quiet ways out on the paste and shortcut steps finish setup; Skip on Try it moves on.
  assert.equal(setupFooter({ ...base, step: 2, pasteStarted: true }).quiet?.finishes, true);
  assert.equal(setupFooter({ ...base, step: 1 }).quiet?.finishes, undefined);
});

test('a double-click on the primary runs its first action only; keyboard presses and single clicks run it, held runs nothing', () => {
  const base: OnboardingState = { step: 1, windows: false, firstName: '', explained: false, pasteStarted: false, ownCodeDone: false, offer: 'offer' };
  // Lead S1 (#372): the first click explains the sample, the button becomes Next in place, and the second click
  // (detail 2) must not move on to Your code.
  assert.equal(primaryPress(setupFooter(base), 1), 'explainSample');
  assert.equal(primaryPress(setupFooter({ ...base, explained: true }), 2), null);
  // Return or Space on the focused button (detail 0) and a later single click still move on.
  assert.equal(primaryPress(setupFooter({ ...base, explained: true }), 0), 'forward');
  assert.equal(primaryPress(setupFooter({ ...base, explained: true }), 1), 'forward');
  // The other carries this layout keeps: Let's go into Explain this code, Next into Explain my clipboard.
  assert.equal(primaryPress(setupFooter({ ...base, step: 1 }), 2), null);
  assert.equal(primaryPress(setupFooter({ ...base, step: 2, explained: true }), 2), null);
  for (const s of allStates()) {
    const f = setupFooter(s);
    if (f.held) assert.equal(primaryPress(f, 1), null, JSON.stringify(s));
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
