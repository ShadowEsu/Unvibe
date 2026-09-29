/** Floating-bar notifications with rate limiting + quiet-hours suppression. */
import type { BrowserWindow } from 'electron';
import { settings } from './settings';
import { showBar } from './windows';

let bar: BrowserWindow | null = null;
let lastAt = 0;
const MIN_GAP_MS = 15_000;
let pulseSequence = 0;
let finalizingAt = 0;
let pendingReady: ReturnType<typeof setTimeout> | null = null;

export function setBar(win: BrowserWindow): void {
  bar = win;
}

export function notify(message: string): void {
  if (!settings().all().notifications) return;
  if (settings().inQuietHours()) return;
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  if (bar && !bar.isDestroyed()) {
    showBar(bar);
    bar.webContents.send('bar:notify', message);
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
