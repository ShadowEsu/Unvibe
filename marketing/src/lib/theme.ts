/** localStorage key for the visitor's theme choice ("light" | "dark"; absent = follow the system). */
export const THEME_STORAGE_KEY = "unvibe-theme";

/**
 * Inline <head> script, run before first paint:
 * - `js` on <html> scopes motion start states, so without JS the page renders its final frame;
 * - `dark` on <html> when the stored choice, or else the system, is dark, so there is no light flash.
 * Only the storage read is guarded: when storage throws (site data blocked), the system theme still applies.
 */
export const BOOT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("js");var p=null;try{p=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}var t=p==="light"||p==="dark"?p:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(t==="dark")d.classList.add("dark");d.style.colorScheme=t})()`;
