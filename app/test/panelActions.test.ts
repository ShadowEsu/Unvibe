import test from 'node:test';
import assert from 'node:assert/strict';
import { actionRow, type Phase } from '../src/renderer/widget/panelModel';

test('streaming, done, Test me and error all keep the action row, so its buttons never jump or vanish', () => {
  // Test me runs on a finished explanation (phase done with the quiz rail open).
  for (const [phase, typing] of [['streaming', true], ['done', true], ['done', false], ['error', false]] as Array<[Phase, boolean]>) {
    assert.ok(actionRow(phase, typing, false), `${phase}${typing ? ' (typing)' : ''} shows the row`);
  }
  for (const phase of ['boot', 'ready', 'aiConsent', 'confirm', 'empty', 'consent', 'blocked'] as Phase[]) {
    assert.equal(actionRow(phase, false, false), null, `${phase} has no explanation frame`);
  }
});

test('Understand and Test me stay off until the explanation has finished typing out', () => {
  assert.equal(actionRow('streaming', true, false)!.ready, false);
  assert.equal(actionRow('done', true, false)!.ready, false, 'done but still revealing text');
  assert.equal(actionRow('error', false, false)!.ready, false, 'nothing to understand after an error');
  assert.equal(actionRow('done', false, false)!.ready, true);
});

test('Stop generating takes the right-hand slot only while words arrive, then the saved note replaces it', () => {
  assert.equal(actionRow('streaming', true, false)!.right, 'stop');
  assert.equal(actionRow('done', true, false)!.right, 'saved');
  assert.equal(actionRow('done', false, false)!.right, 'saved');
  assert.equal(actionRow('done', false, true)!.right, 'mock', 'a mock explanation is not saved as a real one');
  assert.equal(actionRow('error', false, false)!.right, 'none');
});
