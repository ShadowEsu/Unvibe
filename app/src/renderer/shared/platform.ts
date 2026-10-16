/** Renderer-side platform wording. The app is macOS-first; Windows gets its own key names. */
const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;

export const isWindows = /Windows|Win32|Win64/i.test(ua);
export const isMac = /Macintosh|Mac OS X/i.test(ua);

/** Modifier prefix for in-app shortcuts: '⌘K' on a Mac, 'Ctrl+K' elsewhere. */
export const modKey = isMac ? '⌘' : 'Ctrl+';

/** What to call this computer in copy ("saved on this Mac" / "saved on this PC"). */
export const deviceName = isMac ? 'Mac' : 'PC';

/** Value for <html data-platform>, used by CSS that only applies to one OS. */
export const platformAttr = isWindows ? 'win' : isMac ? 'mac' : 'other';

/** The review shortcut as onboarding shows it before settings load (the platform default). */
export const reviewKeyParts = isWindows ? ['Ctrl', 'Alt', 'U'] : ['⌘', 'U'];
export const reviewKeyHint = isWindows ? 'Ctrl+Alt+U' : '⌘U';

/** One-line voice instructions: macOS Dictation, or Windows voice typing (Win+H). */
export const voiceHowTo = isWindows
  ? 'Press Win+H, talk, then Enter.'
  : 'Press fn twice, talk about your code, press Return.';
