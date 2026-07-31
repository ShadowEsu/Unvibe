/**
 * Render an Electron accelerator (settings.shortcut) for display in the bar,
 * widget, and companion. One canonical formatter so every surface shows the
 * same keycap string (e.g. "⌘U", "⌃⇧K", "⌘⌥⇧P").
 */
export function formatAccelerator(accel: string): string {
  return accel
    .replace('CommandOrControl', '⌘')
    .replace('Command', '⌘')
    .replace('Control', '⌃')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace(/\+/g, '');
}
