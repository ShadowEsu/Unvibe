import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  AUTO_COOLDOWN_MS,
  AUTO_REPEAT_MS,
  AUTO_SETTLE_MS,
  AutoExplainGate,
  AutoSettle,
  bigEnoughForAuto,
  bubbleState,
  ghostAllowedIn,
  ghostPlacement,
  ghostWindowBounds,
  isBubbleChoice,
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

test('the ghost is never placed under the resting pointer, even after a short leftward drag at the right edge', () => {
  const under = (g: { x: number; y: number }, p: { x: number; y: number }) => p.x >= g.x - 4 && p.x < g.x + 36 && p.y >= g.y - 4 && p.y < g.y + 36;
  // Near the right edge the ghost flips left of the drag's start; a 20 pt leftward drag rests inside that spot.
  const start = { x: 1400, y: 300 };
  const rest = { x: 1380, y: 300 };
  assert.equal(under(ghostPlacement(start, work, 130), rest), true);
  const placed = ghostPlacement(start, work, 130, rest);
  assert.equal(under(placed, rest), false, JSON.stringify(placed));
  assert.ok(placed.x + 32 <= work.x + work.width && placed.y + 32 <= work.y + work.height);
  // Away from the edge a leftward drag's rest point is left of the ghost, so nothing moves.
  assert.deepEqual(ghostPlacement({ x: 400, y: 300 }, work, 130, { x: 380, y: 300 }), { x: 408, y: 284, flipped: false });
  // At the bottom of the work area it goes over the pointer instead of under it.
  const low = ghostPlacement({ x: 1400, y: 890 }, work, 130, { x: 1385, y: 890 });
  assert.equal(under(low, { x: 1385, y: 890 }), false, JSON.stringify(low));
  // The helper's resting point is optional and range-checked like the rest.
  assert.deepEqual(parseHelperLine('{"e":"select","x":10,"y":20,"px":15,"py":20,"app":"com.microsoft.VSCode","g":"drag"}'), { e: 'select', x: 10, y: 20, px: 15, py: 20, app: 'com.microsoft.VSCode', g: 'drag' });
  assert.deepEqual(parseHelperLine('{"e":"select","x":10,"y":20,"px":"15","py":20,"app":"com.microsoft.VSCode","g":"drag"}'), { e: 'select', x: 10, y: 20, app: 'com.microsoft.VSCode', g: 'drag' });
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

test('Unvibe itself coming to the front (a synthesized click on its panel activates it) keeps the button, so the press lands', () => {
  const win = { ...mac, platform: 'win32' as const };
  assert.equal(reduceGhost(shown(), { e: 'app', app: 'com.unvibe.app' }, mac).effect, 'none');
  const pressed = reduceGhost(reduceGhost(shown(), { e: 'app', app: 'com.unvibe.app' }, mac).state, { e: 'press' }, mac);
  assert.equal(pressed.effect, 'explain');
  const card = reduceGhost(shown(), { e: 'press' }, { ...mac, previewOn: true }).state;
  assert.equal(reduceGhost(card, { e: 'app', app: 'com.unvibe.app' }, mac).effect, 'none');
  assert.equal(reduceGhost(shown(), { e: 'app', app: 'Unvibe.exe' }, win).effect, 'none');
  // Only Unvibe's exact id: another app whose name merely contains it still dismisses.
  assert.equal(reduceGhost(shown(), { e: 'app', app: 'com.example.unvibe-notes' }, mac).state.look, 'hidden');
});

test('selecting text on the open card keeps the card and its result; a selection elsewhere in the editor replaces it', () => {
  const card = reduceGhost(shown(), { e: 'press' }, { ...mac, previewOn: true }).state;
  assert.equal(card.look, 'preview');
  const select = { e: 'select' as const, x: 420, y: 320, app: 'com.microsoft.VSCode', g: 'double' as const };
  assert.deepEqual(reduceGhost(card, select, { ...mac, inside: () => true }), { state: card, effect: 'none' });
  assert.equal(reduceGhost(card, select, mac).state.look, 'ghost');
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

test('every control starts off, Quick look and auto mode need the button on, and the latest choice wins', () => {
  assert.deepEqual(bubbleState([]), { ghost: false, preview: false, auto: false });
  const at = '2026-11-19T00:00:00.000Z';
  const v = '2026-11-11';
  assert.deepEqual(bubbleState([{ item: 'preview', on: true, copyVersion: v, at }, { item: 'auto', on: true, copyVersion: v, at }]), { ghost: false, preview: false, auto: false });
  const all = [{ item: 'ghost' as const, on: true, copyVersion: v, at }, { item: 'preview' as const, on: true, copyVersion: v, at }, { item: 'auto' as const, on: true, copyVersion: v, at }];
  assert.deepEqual(bubbleState(all), { ghost: true, preview: true, auto: true });
  assert.deepEqual(bubbleState([...all, { item: 'auto', on: false, copyVersion: v, at }]), { ghost: true, preview: true, auto: false });
  assert.deepEqual(bubbleState([...all, { item: 'ghost', on: false, copyVersion: v, at }]), { ghost: false, preview: false, auto: false });
  assert.equal(isBubbleChoice({ item: 'auto', on: true, copyVersion: v, at }), true);
  assert.equal(isBubbleChoice({ item: 'auto', on: 'yes', copyVersion: v, at }), false);
  assert.equal(isBubbleChoice({ item: 'autoplay', on: true, copyVersion: v, at }), false);
});

test('auto mode waits 700 ms after the mouse-up, and any change to the button in that time cancels it', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let current: object = { look: 'ghost' };
    const fired: object[] = [];
    const settle = new AutoSettle(() => current, (armed) => fired.push(armed));
    const armed = current;
    settle.arm(armed);
    mock.timers.tick(AUTO_SETTLE_MS - 1);
    assert.equal(fired.length, 0, 'not before the selection has stayed put');
    mock.timers.tick(1);
    assert.deepEqual(fired, [armed]);
    // A click, scroll or new selection changes the button: the caller cancels.
    settle.arm(armed);
    mock.timers.tick(AUTO_SETTLE_MS - 100);
    settle.cancel();
    mock.timers.tick(1_000);
    assert.equal(fired.length, 1, 'cancelled');
    // A new selection re-arms: the wait starts again from its mouse-up.
    settle.arm(armed);
    mock.timers.tick(AUTO_SETTLE_MS - 100);
    current = { look: 'ghost' };
    settle.arm(current);
    mock.timers.tick(AUTO_SETTLE_MS - 1);
    assert.equal(fired.length, 1, 'the first wait was replaced');
    mock.timers.tick(1);
    assert.equal(fired.length, 2);
    // The button changed without a cancel: the wait ends without firing.
    settle.arm(current);
    current = { look: 'hidden' };
    mock.timers.tick(AUTO_SETTLE_MS);
    assert.equal(fired.length, 2, 'fires only for the state it was armed for');
  } finally {
    mock.timers.reset();
  }
});

test('an auto run under way holds the button\'s idle for its state until it ends, failed or not, and a newer run keeps its own hold (QA run 6 X8)', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let current: object = { look: 'ghost' };
    const ends: Array<{ settle: () => void; fail: () => void }> = [];
    const held: Array<[object, boolean]> = [];
    const settle: AutoSettle<object> = new AutoSettle(
      () => current,
      () => new Promise<void>((resolve, reject) => ends.push({ settle: resolve, fail: () => reject(new Error('read failed')) })),
      AUTO_SETTLE_MS,
      (armed) => held.push([armed, settle.holds(armed)]),
    );
    const first = current;
    assert.equal(settle.holds(first), false, 'nothing held before the wait ends');
    settle.arm(first);
    mock.timers.tick(AUTO_SETTLE_MS);
    assert.equal(settle.holds(first), true, 'held while the read runs');
    assert.deepEqual(held, [[first, true]]);
    assert.equal(settle.holds({ look: 'ghost' }), false, 'only for the state it was armed for');
    ends[0]!.settle();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settle.holds(first), false, 'released when the run ends');
    assert.deepEqual(held, [[first, true], [first, false]]);

    // A run that throws releases too.
    settle.arm(first);
    mock.timers.tick(AUTO_SETTLE_MS);
    ends[1]!.fail();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settle.holds(first), false);

    // A new selection's run while the old one is still reading: the old one ending leaves the new hold alone.
    settle.arm(first);
    mock.timers.tick(AUTO_SETTLE_MS);
    current = { look: 'ghost' };
    settle.arm(current);
    mock.timers.tick(AUTO_SETTLE_MS);
    ends[2]!.settle();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settle.holds(current), true, 'the newer run still holds its state');
    ends[3]!.settle();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settle.holds(current), false);
  } finally {
    mock.timers.reset();
  }
});

test('auto mode sends only a selection of at least 2 lines or 40 characters', () => {
  assert.equal(bigEnoughForAuto('x'.repeat(39)), false);
  assert.equal(bigEnoughForAuto('x'.repeat(40)), true);
  assert.equal(bigEnoughForAuto(`  ${'x'.repeat(39)}  \n`), false, 'surrounding space does not count');
  assert.equal(bigEnoughForAuto('a = 1\nb = 2'), true);
  assert.equal(bigEnoughForAuto('a = 1\n\n   \n'), false, 'blank lines do not count');
  assert.equal(bigEnoughForAuto(''), false);
});

test('auto mode: one explanation in flight, 15 s between reads (explained or not), no repeat within 10 minutes, too small is skipped', () => {
  const gate = new AutoExplainGate();
  const big = 'function total(items) {\n  return items.length;\n}';
  const free = { busy: false, limited: false };
  let now = 1_000_000;
  assert.equal(gate.before(now, { busy: true, limited: false }), 'busy', 'a new selection never cancels the one in flight');
  assert.equal(gate.before(now, free), 'read');
  assert.equal(gate.after(now, 'x', 'h-small'), 'small');
  // MUST-A2: a read that explained nothing still went through the clipboard, so it starts the 15 s too.
  assert.equal(gate.before(now + AUTO_COOLDOWN_MS - 1, free), 'cooldown', 'at most one auto copy every 15 s');
  now += AUTO_COOLDOWN_MS;
  assert.equal(gate.before(now, free), 'read');
  assert.equal(gate.after(now, big, 'h1'), 'start');
  const firstStart = now;
  assert.equal(gate.before(now + AUTO_COOLDOWN_MS - 1, free), 'cooldown');
  now += AUTO_COOLDOWN_MS;
  assert.equal(gate.before(now, free), 'read');
  assert.equal(gate.after(now, big, 'h1'), 'repeat', 'the same text within 10 minutes');
  assert.equal(gate.before(now + AUTO_COOLDOWN_MS - 1, free), 'cooldown', 'a repeat was read too');
  now += AUTO_COOLDOWN_MS;
  assert.equal(gate.before(now, free), 'read');
  assert.equal(gate.after(now, big, 'h2'), 'start');
  assert.equal(gate.after(firstStart + AUTO_REPEAT_MS - 1, big, 'h1'), 'repeat');
  assert.equal(gate.after(firstStart + AUTO_REPEAT_MS, big, 'h1'), 'start', '10 minutes after it started, the same text explains again');
});

test('at a limit auto mode shows it once, then starts nothing until a selection after it resets', () => {
  const gate = new AutoExplainGate();
  const limited = { busy: false, limited: true };
  assert.equal(gate.before(0, limited), 'show-limit');
  for (let i = 1; i <= 5; i += 1) assert.equal(gate.before(i * AUTO_COOLDOWN_MS, limited), 'limit', `selection ${i} at the limit`);
  assert.equal(gate.before(10 * AUTO_COOLDOWN_MS, { busy: true, limited: true }), 'limit', 'the limit wins over in-flight');
  // Reset: the next selection reads again, and a later limit is shown again, once.
  assert.equal(gate.before(11 * AUTO_COOLDOWN_MS, { busy: false, limited: false }), 'read');
  assert.equal(gate.before(12 * AUTO_COOLDOWN_MS, limited), 'show-limit');
  assert.equal(gate.before(13 * AUTO_COOLDOWN_MS, limited), 'limit');
});

test('Quick look shows at most 3 bullets from the stream, and a title from the selection', () => {
  assert.deepEqual(previewBullets('- Wraps `fn` so it runs once\n- Each call resets the timer\n- Not sure: `wait` units\n- extra'), ['Wraps `fn` so it runs once', 'Each call resets the timer', 'Not sure: `wait` units']);
  assert.deepEqual(previewBullets('Sure! Here:\n- one\n- tw'), ['one', 'tw']);
  assert.deepEqual(previewBullets('no bullets at all'), []);
  assert.equal(previewTitle('function debounce(fn, wait) {\n  let t;\n}\n'), 'debounce · 3 lines');
  assert.equal(previewTitle('x += 1'), '1 line');
});
