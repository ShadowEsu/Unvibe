/**
 * Cross-platform selection capture: save clipboard → focus the user's editor if
 * needed → synthesize a copy keystroke → read → restore clipboard.
 * macOS uses System Events (Accessibility). Windows uses PowerShell SendKeys.
 * A failed capture intentionally returns null so the shortcut never explains
 * stale clipboard contents when the user did not select anything.
 */
import { clipboard } from 'electron';
import { execFile } from 'node:child_process';

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function osascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 5000 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout.trim()),
    );
  });
}

function powershell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout ?? '').trim())),
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
  if (!isMac && !isWin) return;
  watchTimer = setInterval(() => {
    void frontmostApp().then((name) => {
      if (name && !isSelfApp(name)) lastForeignApp = name;
    });
  }, 600);
}

export async function frontmostApp(): Promise<string | null> {
  try {
    if (isMac) {
      return await osascript(
        'tell application "System Events" to get name of first application process whose frontmost is true',
      );
    }
    if (isWin) {
      const name = await powershell(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class UnvibeFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
$h = [UnvibeFg]::GetForegroundWindow()
$procId = 0
[void][UnvibeFg]::GetWindowThreadProcessId($h, [ref]$procId)
if ($procId -gt 0) {
  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($p) { $p.ProcessName }
}
`);
      return name || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function activateApp(name: string): Promise<void> {
  if (isMac) {
    const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    await osascript(`tell application "${escaped}" to activate`);
    await delay(160);
    return;
  }
  if (isWin) {
    const safe = name.replace(/'/g, "''");
    await powershell(`
$w = New-Object -ComObject WScript.Shell
$procs = @(Get-Process -Name '${safe}' -ErrorAction SilentlyContinue)
if ($procs.Count -gt 0) {
  $null = $w.AppActivate($procs[0].Id)
  Start-Sleep -Milliseconds 160
}
`);
  }
}

async function syntheticCopy(): Promise<void> {
  if (isMac) {
    await osascript('tell application "System Events" to keystroke "c" using command down');
    return;
  }
  if (isWin) {
    await powershell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^c')
`);
  }
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
  if (!isMac && !isWin) return null;

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

    // Give the OS a beat to commit the cleared pasteboard before asking the editor
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
