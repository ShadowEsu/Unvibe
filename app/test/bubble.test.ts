import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bubbleState,
  ghostAllowedIn,
  ghostPlacement,
  ghostWindowBounds,
  parseHelperLine,
  previewBullets,
  previewTitle,
  reduceGhost,
  type GhostState,
} from '../src/core/bubble';

const work = { x: 0, y: 25, width: 1440, height: 875 };
const nowhere = () => false;
const mac = { platform: 'darwin' as const, previewOn: false, inside: nowhere };

test('the ghost shows only in code editors, never in a password manager or Unvibe, and JetBrains only on Windows', () => {
  assert.equal(ghostAllowedIn('darwin', 'com.microsoft.VSCode'), true);
  assert.equal(ghostAllowedIn('darwin', 'com.todesktop.230313mzl4w4u92'), true);
  assert.equal(ghostAllowedIn('win32', 'Code.exe'), true);
  assert.equal(ghostAllowedIn('win32', 'idea64.exe'), true);
  assert.equal(ghostAllowedIn('darwin', 'com.jetbrains.intellij'), false);
  for (const app of ['com.apple.Safari', 'com.google.Chrome', 'com.apple.Terminal', 'com.1password.1password', 'com.unvibe.app', '']) {
    assert.equal(ghostAllowedIn('darwin', app), false, app);
  }
  for (const app of ['chrome.exe', 'WindowsTerminal.exe', '1Password.exe', 'KeePassXC.exe', 'Unvibe.exe']) {
    assert.equal(ghostAllowedIn('win32', app), false, app);
  }
});

test('a helper line parses only as one of its known events; text, junk and out-of-range values are dropped', () => {
  assert.deepEqual(parseHelperLine('{"e":"select","x":400,"y":300,"app":"com.microsoft.VSCode","g":"drag"}'), { e: 'select', x: 400, y: 300, app: 'com.microsoft.VSCode', g: 'drag' });
  assert.deepEqual(parseHelperLine('{"e":"down","x":1,"y":2,"extra":"ignored"}'), { e: 'down', x: 1, y: 2 });
  assert.deepEqual(parseHelperLine('{"e":"app","app":"Code.exe"}'), { e: 'app', app: 'Code.exe' });
  const select = parseHelperLine('{"e":"select","x":1,"y":2,"app":"Code.exe","g":"double","text":"const secret = 1"}');
  assert.equal(select !== null && 'text' in select, false);
  for (const line of ['', 'not json', '[]', 'null', '{"e":"select","x":"1","y":2,"app":"a","g":"drag"}', '{"e":"select","x":1,"y":2,"app":"a","g":"hover"}',
    '{"e":"select","x":1e9,"y":2,"app":"a","g":"drag"}', '{"e":"down","x":null,"y":2}', '{"e":"key","x":1,"y":2}', `{"e":"app","app":"${'a'.repeat(300)}"}`, '{"e":"app","app":"a\\nb"}']) {
    assert.equal(parseHelperLine(line), null, line);
  }
});

test('the ghost sits 8 pt right of the mouse-up, flips left at the edge, and stays in the work area', () => {
  assert.deepEqual(ghostPlacement({ x: 400, y: 300 }, work), { x: 408, y: 284, flipped: false });
  const edge = ghostPlacement({ x: 1400, y: 300 }, work);
  assert.equal(edge.flipped, true);
  assert.equal(edge.x, 1400 - 8 - 32);
  // Under the menu bar it moves down, never over it.
  assert.equal(ghostPlacement({ x: 400, y: 20 }, work).y, 25);
  // A flipped pill grows left, so it never runs off the screen.
  const pill = ghostWindowBounds(edge, 'pill', work);
  assert.ok(pill.x + pill.width <= work.x + work.width);
  // The card goes above when the work area ends below the ghost.
  const low = ghostPlacement({ x: 400, y: 880 }, work);
  const card = ghostWindowBounds(low, 'preview', work, 200);
  assert.ok(card.y + card.height <= work.y + work.height);
});

function shown(): GhostState {
  return reduceGhost({ look: 'hidden' }, { e: 'select', x: 400, y: 300, app: 'com.microsoft.VSCode', g: 'drag' }, mac).state;
}

test('a selection in an editor shows the ghost; in any other app nothing shows, and an open ghost goes', () => {
  assert.equal(shown().look, 'ghost');
  const other = reduceGhost(shown(), { e: 'select', x: 1, y: 1, app: 'com.apple.Safari', g: 'drag' }, mac);
  assert.deepEqual(other, { state: { look: 'hidden' }, effect: 'hide' });
  assert.equal(reduceGhost({ look: 'hidden' }, { e: 'select', x: 1, y: 1, app: 'com.apple.Safari', g: 'drag' }, mac).effect, 'none');
});

test('a click, right click or scroll elsewhere, or another app, dismisses it; one on the ghost itself does not', () => {
  for (const e of ['down', 'right', 'scroll'] as const) {
    assert.equal(reduceGhost(shown(), { e, x: 10, y: 10 }, mac).state.look, 'hidden', e);
    assert.equal(reduceGhost(shown(), { e, x: 410, y: 290 }, { ...mac, inside: () => true }).effect, 'none', e);
  }
  assert.equal(reduceGhost(shown(), { e: 'app', app: 'com.apple.Safari' }, mac).state.look, 'hidden');
  assert.equal(reduceGhost(shown(), { e: 'app', app: 'com.microsoft.VSCode' }, mac).effect, 'none');
});

test('an untouched ghost leaves after its idle time, but not while the pointer is on it', () => {
  assert.equal(reduceGhost(shown(), { e: 'idle' }, mac).state.look, 'hidden');
  const hovered = reduceGhost(shown(), { e: 'hover', on: true }, mac).state;
  assert.equal(hovered.look, 'pill');
  assert.equal(reduceGhost(hovered, { e: 'idle' }, mac).effect, 'none');
  assert.equal(reduceGhost(hovered, { e: 'hover', on: false }, mac).state.look, 'ghost');
});

test('a press explains like Control+U, or opens Quick look when it is on; hover alone never does either', () => {
  assert.deepEqual(reduceGhost(shown(), { e: 'press' }, mac), { state: { look: 'hidden' }, effect: 'explain' });
  const preview = reduceGhost(shown(), { e: 'press' }, { ...mac, previewOn: true });
  assert.equal(preview.effect, 'preview');
  assert.equal(preview.state.look, 'preview');
  assert.notEqual(reduceGhost(shown(), { e: 'hover', on: true }, { ...mac, previewOn: true }).effect, 'preview');
  // A second press on a closed ghost does nothing: one press per selection.
  assert.equal(reduceGhost({ look: 'hidden' }, { e: 'press' }, mac).effect, 'none');
  // The card closes on a click elsewhere, a new selection replaces it, and idle time never closes it.
  assert.equal(reduceGhost(preview.state, { e: 'down', x: 1, y: 1 }, mac).state.look, 'hidden');
  assert.equal(reduceGhost(preview.state, { e: 'select', x: 9, y: 9, app: 'com.microsoft.VSCode', g: 'drag' }, mac).state.look, 'ghost');
  assert.equal(reduceGhost(preview.state, { e: 'idle' }, mac).effect, 'none');
});

test('both controls start off, Quick look needs the button on, and the latest choice wins', () => {
  assert.deepEqual(bubbleState([]), { ghost: false, preview: false });
  const at = '2026-11-19T00:00:00.000Z';
  const v = '2026-11-11';
  assert.deepEqual(bubbleState([{ item: 'preview', on: true, copyVersion: v, at }]), { ghost: false, preview: false });
  const both = [{ item: 'ghost' as const, on: true, copyVersion: v, at }, { item: 'preview' as const, on: true, copyVersion: v, at }];
  assert.deepEqual(bubbleState(both), { ghost: true, preview: true });
  assert.deepEqual(bubbleState([...both, { item: 'ghost', on: false, copyVersion: v, at }]), { ghost: false, preview: false });
});

test('Quick look shows at most 3 bullets from the stream, and a title from the selection', () => {
  assert.deepEqual(previewBullets('- Wraps `fn` so it runs once\n- Each call resets the timer\n- Not sure: `wait` units\n- extra'), ['Wraps `fn` so it runs once', 'Each call resets the timer', 'Not sure: `wait` units']);
  assert.deepEqual(previewBullets('Sure! Here:\n- one\n- tw'), ['one', 'tw']);
  assert.deepEqual(previewBullets('no bullets at all'), []);
  assert.equal(previewTitle('function debounce(fn, wait) {\n  let t;\n}\n'), 'debounce · 3 lines');
  assert.equal(previewTitle('x += 1'), '1 line');
});
