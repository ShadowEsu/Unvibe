/**
 * macOS selection capture: save clipboard → synthesize ⌘C via System Events →
 * read → restore clipboard. Requires the Accessibility permission (granted once
 * at onboarding). Returns null when nothing was captured — callers must offer
 * the explicit "use clipboard" fallback instead of silently reading it.
 */
import { clipboard } from 'electron';
import { execFile } from 'node:child_process';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function osascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 3000 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout.trim()),
    );
  });
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

export async function captureSelection(): Promise<string | null> {
  const previous = clipboard.readText();
  clipboard.writeText('');
  try {
    await osascript('tell application "System Events" to keystroke "c" using command down');
    await delay(220);
    const grabbed = clipboard.readText();
    return grabbed.length > 0 ? grabbed : null;
  } catch {
    return null; // Accessibility permission missing or osascript failed.
  } finally {
    clipboard.writeText(previous);
  }
}
