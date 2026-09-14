/** Display an Electron accelerator in the glyphs this OS actually uses. */
export function prettyShortcut(value = 'CommandOrControl+U', windows = /Win/i.test(navigator.userAgent)): string {
  if (windows) {
    return value
      .replace(/CommandOrControl\+/g, 'Ctrl+')
      .replace(/Command\+/g, 'Ctrl+')
      .replace(/Control\+/g, 'Ctrl+');
  }
  return value
    .replace(/CommandOrControl/g, '⌘')
    .replace(/Command/g, '⌘')
    .replace(/Control/g, '⌃')
    .replace(/Alt/g, '⌥')
    .replace(/Shift/g, '⇧')
    .replace(/\+/g, '');
}
