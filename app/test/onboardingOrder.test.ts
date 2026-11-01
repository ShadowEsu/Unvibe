import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { setupForward, setupSteps, type SetupStep } from '../src/renderer/companion/onboardingFlow';
import { ShortcutGuide } from '../src/renderer/shared/shortcutGuide';

test('first run gives before it asks: the sample explanation comes first, the name and Google sync after it (Design A10)', () => {
  for (const windows of [false, true]) {
    const steps = setupSteps(windows);
    assert.equal(steps[0], 'try', 'setup opens on the sample, not on a question');
    assert.ok(steps.indexOf('you') > steps.indexOf('try'), 'the name question follows the first explanation');
    assert.equal(new Set(steps).size, steps.length);
  }
  const mac = setupSteps(false);
  // Value first, permission second: the Accessibility offer stays after the own-code step, last.
  assert.ok(mac.indexOf('code') < mac.indexOf('shortcut'));
  assert.equal(mac.at(-1), 'shortcut');
});

test('every skip in setup is the same outlined button, never a filled one that outweighs the step (Design P12)', () => {
  const states = [
    { explained: false, ownCodeDone: false, shortcutOn: false },
    { explained: true, ownCodeDone: true, shortcutOn: true },
    { explained: true, ownCodeDone: false, shortcutOn: false },
  ];
  const skips = new Set<string>();
  for (const step of ['try', 'you', 'code', 'shortcut', 'anywhere'] as SetupStep[]) {
    for (const state of states) {
      const forward = setupForward(step, state);
      // Anything that is not moving on ("Next") or finishing ("Start using Unvibe") is a skip.
      if (forward.label === 'Next' || forward.label === 'Start using Unvibe') continue;
      skips.add(forward.label);
      assert.equal(forward.ghost, true, `${step}: "${forward.label}" is outlined`);
    }
  }
  assert.equal(skips.size, 1, 'one name for skip');
  // Before the sample, the step's own primary is Explain this code, so its skip must be the outlined one.
  assert.equal(setupForward('try', states[0]!).ghost, true);
  assert.equal(setupForward('try', states[0]!).finishes, false, 'skipping the sample still asks the name next');
  // Once explained, moving on is the step's main action.
  assert.equal(setupForward('try', states[1]!).ghost, false);
});

test('setup\'s waiting screen starts with its help folded; the panel keeps it open (Design A10, B-2)', () => {
  const folded = renderToStaticMarkup(createElement(ShortcutGuide, { buttonClass: 'act', illustration: true, helpOpen: false }));
  assert.match(folded, /<details class="shortcut-guide__fix">/);
  const panel = renderToStaticMarkup(createElement(ShortcutGuide, { buttonClass: 'btn ghost' }));
  assert.match(panel, /<details class="shortcut-guide__fix" open="">/);
});
