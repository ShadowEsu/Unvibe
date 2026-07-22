import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIsland, isTransient, PRODUCT_STATES, type ProductState } from '../src/core/islandState';

test('idle is dormant, calm, silent', () => {
  const v = resolveIsland('idle');
  assert.equal(v.presentation, 'dormant');
  assert.equal(v.accent, 'idle');
  assert.equal(v.sound, null);
  assert.equal(v.glance, false);
  assert.equal(v.dwellMs, 0);
});

test('selection detected chimes on capture and goes compact', () => {
  const v = resolveIsland('selectionDetected');
  assert.equal(v.sound, 'capture');
  assert.equal(v.presentation, 'compact');
  assert.equal(v.accent, 'active');
});

test('choosing depth is the one interactive state that expands', () => {
  assert.equal(resolveIsland('choosingDepth').presentation, 'expanded');
});

test('explanation ready is a glance-completion success with dwell + ready sound', () => {
  const v = resolveIsland('explanationReady');
  assert.equal(v.accent, 'success');
  assert.equal(v.sound, 'ready');
  assert.equal(v.glance, true);
  assert.ok(v.dwellMs > 0, 'ready should linger');
  // Glance means it stays compact, never force-expands.
  assert.equal(v.presentation, 'compact');
});

test('saved and copied are quick success confirmations', () => {
  assert.equal(resolveIsland('saved').sound, 'saved');
  assert.equal(resolveIsland('copied').sound, 'copied');
  assert.ok(resolveIsland('copied').dwellMs < resolveIsland('saved').dwellMs, 'copied is the briefest');
});

test('milestone lingers longest and plays the milestone sound', () => {
  const v = resolveIsland('milestone');
  assert.equal(v.sound, 'milestone');
  assert.ok(v.dwellMs >= 4000);
});

test('error states are warning/error accents, not silent', () => {
  assert.equal(resolveIsland('serviceError').accent, 'error');
  assert.equal(resolveIsland('serviceError').sound, 'error');
  for (const s of ['offline', 'permissionRequired', 'authenticationExpired', 'rateLimited'] as ProductState[]) {
    assert.equal(resolveIsland(s).accent, 'warning');
    assert.equal(resolveIsland(s).sound, 'warning');
  }
});

test('isTransient matches states with a dwell', () => {
  assert.equal(isTransient('explanationReady'), true);
  assert.equal(isTransient('idle'), false);
  assert.equal(isTransient('streaming'), false);
});

test('every product state resolves without throwing and has non-empty narration', () => {
  for (const s of PRODUCT_STATES) {
    const v = resolveIsland(s);
    assert.ok(v.narration.length > 0, `${s} needs narration`);
    assert.ok(['hidden', 'dormant', 'micro', 'compact', 'expanded', 'fullCard'].includes(v.presentation));
  }
});

test('unknown state falls back to idle safely', () => {
  const v = resolveIsland('nope' as ProductState);
  assert.equal(v.presentation, 'dormant');
});
