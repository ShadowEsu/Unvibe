/** Display an Electron accelerator in the glyphs this OS actually uses: ⌃⌥ on a Mac, Ctrl+Alt on Windows and Linux. */
export function prettyShortcut(value = 'CommandOrControl+U', pcKeys = !/Macintosh|Mac OS X/i.test(navigator.userAgent)): string {
  if (pcKeys) {
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
