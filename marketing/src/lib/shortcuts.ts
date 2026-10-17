/**
 * The keys a new user should press. Keep in sync with DEFAULT_SHORTCUT in
 * app/src/main/settings.ts and the editor bridge keybindings in extension/package.json.
 * `anywhere` works in every app with no extra setup (Mac needs Accessibility once);
 * `editor` only works in Cursor or VS Code after installing the editor bridge.
 */
export const SHORTCUTS = {
  mac: { anywhere: "Control+U", editor: "⌘U" },
  windows: { anywhere: "Ctrl+Alt+U", editor: "Ctrl+U" },
} as const;

export type VisitorDevice = "mac" | "windows" | "phone";

/** Phones and tablets can't run the desktop app, so they get a different call to action. */
export function detectVisitorDevice(userAgent: string, maxTouchPoints = 0): VisitorDevice {
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(userAgent)) return "phone";
  // iPadOS reports a desktop Mac user agent; touch support gives it away.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "phone";
  if (/Windows/i.test(userAgent)) return "windows";
  return "mac";
}
