/**
 * The global shortcuts Unvibe registers. ⌃U is a spare chord on macOS (the IDE bridge owns ⌘U), so
 * the Mac always gets Control+U as well as the person's choice; on Windows Ctrl+U is the bridge's
 * own key and a common app shortcut, so only the person's choice is grabbed. With sending switched
 * off in Settings, none at all (Security CC-5).
 */
export function shortcutKeys(accel: string, isMac: boolean, switchedOff: boolean): string[] {
  if (switchedOff) return [];
  return [...new Set<string>(isMac ? [accel, 'Control+U'] : [accel])];
}
