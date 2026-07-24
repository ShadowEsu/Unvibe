/**
 * macOS selection capture: save clipboard → activate the user's editor if needed →
 * synthesize ⌘C via System Events → read → restore clipboard. Requires Accessibility
 * permission. A failed capture intentionally returns null: ⌘U must never explain stale
 * clipboard contents when the user did not select anything.
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
}

/**
 * Editors update the pasteboard asynchronously, especially for larger selections.
 * Poll briefly instead of assuming a single fixed delay is enough.
 */
async function waitForCopiedText(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(75);
    const text = clipboard.readText();
    if (text.trim().length > 0) return text;
  }
  return '';
}

export async function captureSelection(): Promise<string | null> {
  const previous = clipboard.readText();
  // Empty the text pasteboard so an unchanged clipboard cannot be mistaken for a selection.
  // The explicit “Use clipboard” action remains available in the no-selection picker.
  clipboard.writeText('');
  try {
    const front = await frontmostApp();
    if (isSelfApp(front) && lastForeignApp) {
      await activateApp(lastForeignApp);
    } else if (!isSelfApp(front) && front) {
      lastForeignApp = front;
    }

    // Give macOS a beat to commit the cleared pasteboard before asking the editor
    // to write into it. Without this, VS Code can occasionally return the prior item.
    await delay(60);
    await syntheticCopy();
    let grabbed = await waitForCopiedText();
    if (!grabbed) {
      await syntheticCopy();
      grabbed = await waitForCopiedText();
    }
    if (grabbed.trim().length > 0) return grabbed;
    return null;
  } catch {
    return null;
  } finally {
    clipboard.writeText(previous);
  }
}
