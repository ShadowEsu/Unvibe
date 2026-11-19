/**
 * The ⌘U hint (0.1.54, Control not Command): on a Mac, pressing Command+U while Unvibe's own companion or overlay
 * is focused shows one Island notice naming the real shortcut. Security conditions (20261117-1949, A1/A2): nothing
 * when sending is switched off or when the person's own shortcut isn't Control+U (so never for a Command+U
 * shortcut); the check reads only the key event's type, modifiers and key; no logging, IPC or telemetry; and the
 * key press is never prevented, so an editor field in the app keeps its ⌘U.
 */
import type { BrowserWindow } from 'electron';
import { sendingSwitchedOff } from './consentStore';
import { notify } from './notify';
import { settings } from './settings';

export const COMMAND_U_HINT = 'The shortcut is Control+U, not Command+U.';

export type HintInput = { type: string; key: string; meta: boolean; control: boolean; alt: boolean; shift: boolean };

/**
 * Whether this key event earns the hint. Only plain ⌘U on a Mac, with sending on and the Mac default Control+U as
 * the shortcut: the notice names Control+U, so it would be wrong for any other shortcut, a Command+U one included.
 * Never while Settings is recording a new shortcut: there ⌘U is the person choosing it, not missing it.
 */
export function commandUHint(input: HintInput, { platform, sendingOff, shortcut, recording }: { platform: NodeJS.Platform; sendingOff: boolean; shortcut: string; recording: boolean }): boolean {
  if (platform !== 'darwin' || sendingOff || recording || shortcut !== 'Control+U') return false;
  return input.type === 'keyDown' && input.meta && !input.control && !input.alt && !input.shift && input.key.toLowerCase() === 'u';
}

/** Settings › Activation shortcut is listening for new keys (the companion says when it starts and stops). */
let recordingShortcut = false;
export function setShortcutRecording(on: boolean): void {
  recordingShortcut = on;
}

/**
 * Watches one of Unvibe's windows for ⌘U while it's focused. How often it shows is notify's information limit (one
 * Island notice per 15 s), so repeated presses don't repeat it.
 */
export function watchCommandU(win: BrowserWindow): void {
  if (process.platform !== 'darwin') return;
  win.webContents.on('before-input-event', (_event, input) => {
    if (!input.meta) return;
    if (!commandUHint(input, { platform: process.platform, sendingOff: sendingSwitchedOff(), shortcut: settings().all().shortcut, recording: recordingShortcut })) return;
    notify(COMMAND_U_HINT, { problem: false });
  });
}
