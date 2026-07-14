/**
 * macOS selection capture: save clipboard → activate the user's editor if needed →
 * synthesize ⌘C via System Events → read → restore clipboard. Requires Accessibility
 * permission. Returns null when nothing was captured — callers offer clipboard fallback.
 */
import { clipboard } from 'electron';
import { execFile } from 'node:child_process';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function osascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 4000 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout.trim()),
    );
  });
}

function isSelfApp(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n === 'electron' || n === 'unvibe' || n.includes('unvibe');
}

/** Last non-Unvibe frontmost app — used when Unvibe itself is focused (companion click). */
let lastForeignApp: string | null = null;
let watchTimer: ReturnType<typeof setInterval> | null = null;

export function startFrontmostWatch(): void {
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    void frontmostApp().then((name) => {
      if (name && !isSelfApp(name)) lastForeignApp = name;
    });
  }, 800);
}

export async function frontmostApp(): Promise<string | null> {
  try {
    return await osascript(
      'tell application "System Events" to get name of first application process whose frontmost is true',
    );
  } catch {
    return null;
  }
}

async function activateApp(name: string): Promise<void> {
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  await osascript(`tell application "${escaped}" to activate`);
  await delay(100);
}

export async function captureSelection(): Promise<string | null> {
  const previous = clipboard.readText();
  clipboard.writeText('');
  try {
    const front = await frontmostApp();
    if (isSelfApp(front) && lastForeignApp) {
      await activateApp(lastForeignApp);
    }
    await osascript('tell application "System Events" to keystroke "c" using command down');
    await delay(280);
    const grabbed = clipboard.readText();
    return grabbed.length > 0 ? grabbed : null;
  } catch {
    return null;
  } finally {
    clipboard.writeText(previous);
  }
}
