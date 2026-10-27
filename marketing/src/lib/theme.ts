/**
 * Inline <head> script, run before first paint. `js` on <html> scopes the motion start states, so without
 * JS the page renders its final frame. The site has one light theme for every visitor, so it pins the light
 * colour scheme (form controls, scrollbars, autofill) and reads no stored theme choice.
 */
export const BOOT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("js");d.style.colorScheme="light"})()`;
