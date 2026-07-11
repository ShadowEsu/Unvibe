/** Floating-bar notifications with rate limiting + quiet-hours suppression. */
import type { BrowserWindow } from 'electron';
import { settings } from './settings';

let bar: BrowserWindow | null = null;
let lastAt = 0;
const MIN_GAP_MS = 15_000;

export function setBar(win: BrowserWindow): void {
  bar = win;
}

export function notify(message: string): void {
  if (!settings().all().notifications) return;
  if (settings().inQuietHours()) return;
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) return; // never spammy
  lastAt = now;
  if (bar && !bar.isDestroyed()) bar.webContents.send('bar:notify', message);
}
