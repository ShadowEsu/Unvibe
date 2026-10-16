/**
 * Selection capture: save clipboard → activate the user's editor if needed →
 * synthesize Copy → read → restore clipboard. macOS uses System Events (⌘C).
 * Windows uses SendKeys (Ctrl+Insert — Ctrl+C would interrupt a running terminal process).
 * A failed capture returns no code so the shortcut never explains a stale clipboard
 * when the user did not select anything.
 */
import { clipboard } from 'electron';
import { execFile } from 'node:child_process';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function osascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 5000, windowsHide: true }, (err, stdout) =>
      err ? reject(err) : resolve(stdout.trim()),
    );
  });
}

function powershell(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NoLogo', '-STA', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', command],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout).trim())),
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
  if (!isMac) return;
  watchTimer = setInterval(() => {
    void frontmostApp().then((name) => {
      if (name && !isSelfApp(name)) lastForeignApp = name;
    });
  }, 600);
}

/**
 * Sets $name to the foreground process name. ($pid is PowerShell's read-only automatic
 * variable, so the window's process id goes in $procId.)
 */
const PS_FOREGROUND =
  'Add-Type @"\nusing System;\nusing System.Runtime.InteropServices;\npublic class Fg {\n  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();\n  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);\n}\n"@\n' +
  '$h = [Fg]::GetForegroundWindow(); [uint32]$procId = 0; [void][Fg]::GetWindowThreadProcessId($h, [ref]$procId); ' +
  '$name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName';

/** Ctrl+Insert copies in editors, browsers and consoles without sending SIGINT like Ctrl+C. */
const PS_COPY = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^{INSERT}')";

/** Console hosts where a stray copy keystroke must not be repeated. */
const WINDOWS_TERMINALS = new Set(['windowsterminal', 'powershell', 'pwsh', 'cmd', 'conhost', 'openconsole', 'wezterm', 'wezterm-gui', 'alacritty']);

function isWindowsTerminal(name: string | null): boolean {
  return Boolean(name && WINDOWS_TERMINALS.has(name.toLowerCase()));
}

export async function frontmostApp(): Promise<string | null> {
  try {
    if (isWindows) {
      const name = await powershell(`${PS_FOREGROUND}; $name`);
      return name || null;
    }
    if (!isMac) return null;
    return await osascript(
      'tell application "System Events" to get name of first application process whose frontmost is true',
    );
  } catch {
    return null;
  }
}

async function activateApp(name: string): Promise<void> {
  if (isWindows) {
    const escaped = name.replace(/'/g, "''");
    await powershell(`$w = New-Object -ComObject WScript.Shell; [void]$w.AppActivate('${escaped}')`);
    await delay(160);
    return;
  }
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  await osascript(`tell application "${escaped}" to activate`);
  await delay(160);
}

async function syntheticCopy(): Promise<void> {
  if (isWindows) {
    await powershell(PS_COPY);
    return;
  }
  // Key code 8 is physical C on the current macOS keyboard layout. It is more
  // reliable than a character keystroke in Cursor and VS Code's full-screen
  // editor surfaces.
  await osascript('tell application "System Events" to key code 8 using {command down}');
}

/**
 * Editors update the pasteboard asynchronously, especially for larger selections.
 * Poll briefly instead of assuming a single fixed delay is enough.
 */
async function waitForCopiedText(): Promise<string> {
  // Windows editors and terminals can take longer to commit the copy after SendKeys.
  const attempts = isWindows ? 32 : 18;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await delay(70);
    const text = clipboard.readText();
    if (text.trim().length > 0) return text;
  }
  return '';
}

export interface CaptureResult {
  code: string | null;
  /** The app the selection was read from, when capture already looked it up (Windows). */
  sourceApp?: string | null;
  /** Why no code came back: nothing was copied, or the copy itself failed. */
  error?: 'empty' | 'failed' | 'unsupported';
}

/** Windows: one PowerShell launch finds the foreground app and sends the copy keystroke. */
async function windowsDetectAndCopy(): Promise<string | null> {
  const name = await powershell(`${PS_FOREGROUND}; ${PS_COPY}; $name`);
  return name || null;
}

/**
 * The IDE bridge writes the editor's active selection to the local pasteboard immediately
 * before opening Unvibe. It is still entirely on-device; this mode avoids relying on macOS
 * focus timing after the external application link has been handled.
 */
export async function captureSelection(options: { preferClipboard?: boolean } = {}): Promise<CaptureResult> {
  if (options.preferClipboard) {
    const copied = clipboard.readText();
    return copied.trim().length > 0 ? { code: copied } : { code: null, error: 'empty' };
  }
  if (!isMac && !isWindows) return { code: null, error: 'unsupported' };
  const previous = clipboard.readText();
  // Let Control+U / the saved shortcut release before synthesizing Copy.
  await delay(90);
  // Empty the text pasteboard so an unchanged clipboard cannot be mistaken for a selection.
  // The explicit Use clipboard action remains available in the no-selection picker.
  clipboard.writeText('');
  let sourceApp: string | null | undefined;
  try {
    let grabbed: string;
    if (isWindows) {
      sourceApp = await windowsDetectAndCopy();
      grabbed = await waitForCopiedText();
      // A second keystroke is harmless in an editor but not in a console.
      if (!grabbed && !isWindowsTerminal(sourceApp)) {
        await syntheticCopy();
        grabbed = await waitForCopiedText();
      }
    } else {
      const front = await frontmostApp();
      if (isSelfApp(front) && lastForeignApp) {
        await activateApp(lastForeignApp);
      } else if (!isSelfApp(front) && front) {
        lastForeignApp = front;
      }

      // Give macOS a beat to commit the cleared pasteboard before asking the editor
      // to write into it. Without this, VS Code can occasionally return the prior item.
      await delay(120);
      await syntheticCopy();
      grabbed = await waitForCopiedText();
      if (!grabbed) {
        await syntheticCopy();
        grabbed = await waitForCopiedText();
      }
    }
    if (grabbed.trim().length > 0) return { code: grabbed, sourceApp };
    return { code: null, sourceApp, error: 'empty' };
  } catch {
    return { code: null, sourceApp, error: 'failed' };
  } finally {
    clipboard.writeText(previous);
  }
}
