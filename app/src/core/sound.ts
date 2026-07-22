/**
 * Island sound system (pure decision + palette — unit tested).
 *
 * Original, restrained, locally-synthesized cues. No bundled audio files, nothing
 * remote. The renderer synthesizes these note sequences with the Web Audio API
 * (see renderer/bar). This module owns two things, both testable without audio:
 *   1. the palette (which notes each event plays)
 *   2. shouldPlaySound() — the gate (master toggle, category, quiet hours, quiet-while-locked)
 */
import type { SoundEvent } from './islandState';

export interface SoundSpec {
  /** Note frequencies in Hz, played in sequence. */
  freqs: number[];
  /** Oscillator shape — 'square'/'triangle' give the calm chiptune character. */
  type: 'square' | 'triangle' | 'sine';
  /** Gap between notes (ms). */
  stepMs: number;
  /** Per-note duration (ms). */
  durMs: number;
  /** Peak gain (0..1) — deliberately low. */
  gain: number;
}

/**
 * Unvibe's own sound family — a consistent minor-to-major palette. Short, quiet,
 * never a jingle. Success rises; warning/error fall.
 */
export const SOUND_PALETTE: Record<Exclude<SoundEvent, null>, SoundSpec> = {
  // A soft single tick on capture — "I've got it."
  capture: { freqs: [587.33], type: 'triangle', stepMs: 0, durMs: 90, gain: 0.03 },
  // Two rising notes — the explanation landed.
  ready: { freqs: [523.25, 783.99], type: 'square', stepMs: 90, durMs: 150, gain: 0.035 },
  // A gentle up-tick — saved to your learning.
  saved: { freqs: [659.25, 880.0], type: 'triangle', stepMs: 70, durMs: 120, gain: 0.03 },
  // The lightest blip — copied.
  copied: { freqs: [880.0], type: 'sine', stepMs: 0, durMs: 70, gain: 0.025 },
  // A little three-note arpeggio — a milestone, but tasteful.
  milestone: { freqs: [523.25, 659.25, 987.77], type: 'square', stepMs: 110, durMs: 160, gain: 0.04 },
  // A soft two-note fall — something needs attention.
  warning: { freqs: [493.88, 392.0], type: 'triangle', stepMs: 100, durMs: 150, gain: 0.03 },
  // A slightly lower fall — an error, still gentle.
  error: { freqs: [440.0, 329.63], type: 'square', stepMs: 110, durMs: 170, gain: 0.035 },
};

/** Sound-relevant slice of settings + the live "scene" the app is in. */
export interface SoundGate {
  /** Master interface-sounds toggle. */
  soundEffects: boolean;
  /** Milestone sounds specifically (can be muted without muting everything). */
  soundMilestones: boolean;
  /** Suppress sounds while the screen is locked (detected via powerMonitor). */
  quietWhileLocked: boolean;
  /** Whether quiet hours are active right now (computed by the caller). */
  inQuietHours: boolean;
  /** Whether the screen is currently locked. */
  screenLocked: boolean;
}

/**
 * Decide whether a given sound event should actually play. Pure — the caller passes
 * the resolved gate. Critical warnings/errors still respect the master toggle and
 * an explicit lock, but are NOT muted by quiet hours (they're rare and actionable).
 */
export function shouldPlaySound(event: SoundEvent, gate: SoundGate): boolean {
  if (event === null) return false;
  if (!gate.soundEffects) return false;
  if (gate.quietWhileLocked && gate.screenLocked) return false;
  if (event === 'milestone' && !gate.soundMilestones) return false;

  const critical = event === 'warning' || event === 'error';
  if (gate.inQuietHours && !critical) return false;
  return true;
}
