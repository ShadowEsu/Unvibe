/**
 * Inline <head> script, run before first paint: `js` on <html> scopes motion start states, so without
 * JS the page renders its final frame.
 */
export const BOOT_SCRIPT = `document.documentElement.classList.add("js")`;
