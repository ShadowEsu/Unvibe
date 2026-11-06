/** Floating-bar notifications with rate limiting + quiet-hours suppression. */
import type { BrowserWindow } from 'electron';
import { settings } from './settings';
import { showBar } from './windows';

let bar: BrowserWindow | null = null;
const MIN_GAP_MS = 15_000;
let pulseSequence = 0;
let finalizingAt = 0;
let pendingReady: ReturnType<typeof setTimeout> | null = null;

export function setBar(win: BrowserWindow): void {
  bar = win;
}

/** What the Island receives: the text, and whether something went wrong (amber dot) or it's information (neutral). */
export type BarNotice = { text: string; problem: boolean };

/**
 * The rate limit for Island notices: one per 15 s, except that a problem only waits for an earlier
 * problem. So an information notice can never keep a problem (Couldn't copy, shortcut in use) off the
 * Island, while an information notice never replaces a problem that's still showing. That second half
 * holds because the Island shows a notice for 9 s (bar.tsx), less than this gap.
 */
export function noticeGate(minGapMs = MIN_GAP_MS): (problem: boolean, now: number) => boolean {
  let lastAt = -Infinity;
  let lastProblemAt = -Infinity;
  return (problem, now) => {
    if (now - (problem ? lastProblemAt : lastAt) < minGapMs) return false;
    if (problem) lastProblemAt = now;
    lastAt = now;
    return true;
  };
}

const admit = noticeGate();

/** Island notices are for problems and information the user acts on, never for success (the Island's pulse says Ready/Understood). */
export function notify(message: string, options: { problem: boolean }): void {
  if (!settings().all().notifications) return;
  if (settings().inQuietHours()) return;
  if (!admit(options.problem, Date.now())) return;
  if (bar && !bar.isDestroyed()) {
    showBar(bar);
    const notice: BarNotice = { text: message, problem: options.problem };
    bar.webContents.send('bar:notify', notice);
  }
}

export type BarPulse = {
  phase: 'idle' | 'loading' | 'working' | 'analyzing' | 'searching' | 'thinking' | 'generating' |
    'contextualizing' | 'finalizing' | 'ready' | 'understood' | 'error' | 'offline';
  label: string;
};

/** Island activity. Not rate limited. Never includes source. */
export function pulseBar(pulse: BarPulse): void {
  if (!bar || bar.isDestroyed()) return;
  pulseSequence += 1;
  const sequence = pulseSequence;
  if (pendingReady) {
    clearTimeout(pendingReady);
    pendingReady = null;
  }
  if (pulse.phase === 'finalizing') finalizingAt = Date.now();
  if (pulse.phase === 'ready') {
    const remaining = 650 - (Date.now() - finalizingAt);
    if (remaining > 0) {
      pendingReady = setTimeout(() => {
        pendingReady = null;
        if (sequence !== pulseSequence || !bar || bar.isDestroyed()) return;
        showBar(bar);
        bar.webContents.send('bar:pulse', pulse);
      }, remaining);
      return;
    }
  }
  showBar(bar);
  bar.webContents.send('bar:pulse', pulse);
}
