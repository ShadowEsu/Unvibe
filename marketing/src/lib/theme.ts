/**
 * Inline <head> script, run before first paint: `js` on <html> scopes motion start states, so without
 * JS the page renders its final frame. The site has one light theme for every visitor, so there is no
 * theme to choose here.
 */
export const BOOT_SCRIPT = `(function(){document.documentElement.classList.add("js")})()`;
