/**
 * macOS selection capture: save clipboard → activate the user's editor if needed →
 * synthesize ⌘C via System Events → read → restore clipboard. Requires Accessibility
 * permission. Falls back to the prior clipboard so ⌘U can still auto-explain.
 */
import { clipboard } from 'electron';
import { execFile } from 'node:child_process';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function osascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 5000 }, (err, stdout) =>
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
  }, 600);
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
  await delay(160);
}

async function syntheticCopy(): Promise<void> {
  await osascript('tell application "System Events" to keystroke "c" using command down');
  await delay(420);
}

export async function captureSelection(): Promise<string | null> {
  const previous = clipboard.readText();
  clipboard.writeText('');
  try {
    const front = await frontmostApp();
    if (isSelfApp(front) && lastForeignApp) {
      await activateApp(lastForeignApp);
    } else if (!isSelfApp(front) && front) {
      lastForeignApp = front;
    }

    await syntheticCopy();
    let grabbed = clipboard.readText();
    if (!grabbed) {
      await syntheticCopy();
      grabbed = clipboard.readText();
    }
    if (grabbed.length > 0) return grabbed;
    // Prior clipboard fallback so ⌘U still starts an explanation when AX copy misses.
    return previous.trim().length > 0 ? previous : null;
  } catch {
    return previous.trim().length > 0 ? previous : null;
  } finally {
    clipboard.writeText(previous);
  }
}
