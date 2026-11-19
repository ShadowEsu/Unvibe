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

const MAC_CAPS: Record<string, string> = { CommandOrControl: '⌘', Command: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧' };
const PC_CAPS: Record<string, string> = { CommandOrControl: 'Ctrl', Command: 'Ctrl', Control: 'Ctrl' };

/** The same keys one cap each (Design Q8): ⌃ U on a Mac, Ctrl Alt U on Windows and Linux. */
export function shortcutCaps(value = 'CommandOrControl+U', pcKeys = !/Macintosh|Mac OS X/i.test(navigator.userAgent)): string[] {
  const names = pcKeys ? PC_CAPS : MAC_CAPS;
  return value.split('+').filter(Boolean).map((key) => names[key] ?? key);
}
