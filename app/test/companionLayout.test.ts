import test from 'node:test';
import assert from 'node:assert/strict';
import { ASK_BAR_GAP, bottomRightSlot, scrollEndPadding } from '../src/renderer/companion/layout';

test('a page above the Ask bar gets bottom padding of the bar height plus 16 px, so its last card scrolls clear (Design P2)', () => {
  assert.equal(ASK_BAR_GAP, 16);
  assert.equal(scrollEndPadding(50), 66);
  // A measured height with a fraction (zoom, borders) rounds up: never a pixel short.
  assert.equal(scrollEndPadding(51.5), 68);
  // Before the bar is measured, or on a page without it, only the gap is kept; never a negative padding.
  assert.equal(scrollEndPadding(0), 16);
  assert.equal(scrollEndPadding(-4), 16);
  // A taller bar (a bigger font) gets more room, not a fixed guess.
  assert.ok(scrollEndPadding(80) > scrollEndPadding(50));
});

test('the update card and Vibe share one bottom-right slot: Vibe is put away while the update shows (Design P4)', () => {
  for (const page of ['Home', 'Learn', 'Quiz', 'Briefings', 'Progress', 'Plan', 'Gift']) {
    assert.equal(bottomRightSlot({ updateShown: false, page, settingsOpen: false }), 'vibe', page);
    assert.equal(bottomRightSlot({ updateShown: true, page, settingsOpen: false }), 'update', `${page}: never both at once`);
  }
  // Ask Vibe has Vibe on the page, and Settings covers the window: no corner Vibe there.
  assert.equal(bottomRightSlot({ updateShown: false, page: 'Chat', settingsOpen: false }), null);
  assert.equal(bottomRightSlot({ updateShown: false, page: 'Home', settingsOpen: true }), null);
  // A waiting update still shows on Ask Vibe.
  assert.equal(bottomRightSlot({ updateShown: true, page: 'Chat', settingsOpen: false }), 'update');
});
