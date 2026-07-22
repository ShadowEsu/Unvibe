import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPlaySound, SOUND_PALETTE, type SoundGate } from '../src/core/sound';

const on: SoundGate = {
  soundEffects: true,
  soundMilestones: true,
  quietWhileLocked: true,
  inQuietHours: false,
  screenLocked: false,
};

test('null event never plays', () => {
  assert.equal(shouldPlaySound(null, on), false);
});

test('master toggle mutes everything', () => {
  assert.equal(shouldPlaySound('ready', { ...on, soundEffects: false }), false);
  assert.equal(shouldPlaySound('error', { ...on, soundEffects: false }), false);
});

test('normal sounds play when enabled', () => {
  assert.equal(shouldPlaySound('ready', on), true);
  assert.equal(shouldPlaySound('saved', on), true);
});

test('milestone sound respects its own toggle', () => {
  assert.equal(shouldPlaySound('milestone', on), true);
  assert.equal(shouldPlaySound('milestone', { ...on, soundMilestones: false }), false);
  // muting milestones must not mute other sounds
  assert.equal(shouldPlaySound('ready', { ...on, soundMilestones: false }), true);
});

test('quiet hours mute normal sounds but not critical warnings/errors', () => {
  const quiet = { ...on, inQuietHours: true };
  assert.equal(shouldPlaySound('ready', quiet), false);
  assert.equal(shouldPlaySound('saved', quiet), false);
  assert.equal(shouldPlaySound('warning', quiet), true);
  assert.equal(shouldPlaySound('error', quiet), true);
});

test('screen lock mutes everything when quietWhileLocked is on', () => {
  const locked = { ...on, screenLocked: true };
  assert.equal(shouldPlaySound('ready', locked), false);
  assert.equal(shouldPlaySound('error', locked), false);
  // ...but not if the user turned that off
  assert.equal(shouldPlaySound('ready', { ...locked, quietWhileLocked: false }), true);
});

test('every non-null palette entry has playable notes', () => {
  for (const [name, spec] of Object.entries(SOUND_PALETTE)) {
    assert.ok(spec.freqs.length > 0, `${name} needs notes`);
    assert.ok(spec.gain > 0 && spec.gain < 0.1, `${name} gain should be low`);
    assert.ok(spec.durMs > 0);
  }
});
