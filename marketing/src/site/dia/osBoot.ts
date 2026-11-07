/**
 * OS-aware copy without a swap after hydration (Security MUST-D12): both computers' strings are in the HTML
 * (`lx-mac` / `lx-win`), and `os-win` / `os-phone` on <html>, set before the first paint, show one. `?os=mac|win`
 * forces a computer (QA and the evidence shots). Self-contained: OS_BOOT inlines this function's source.
 */
export function applyOsClasses() {
  const forced = new URLSearchParams(window.location.search).get("os");
  const ua = navigator.userAgent;
  const phone = forced !== "win" && forced !== "mac" && (/iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1));
  const win = !phone && (forced === "win" || (forced !== "mac" && /Windows/i.test(ua)));
  document.documentElement.classList.toggle("os-win", win);
  document.documentElement.classList.toggle("os-phone", phone);
  // /beta?dl=… loaded from the server: Download.tsx's thank-you renders client-side, so until it has, CSS holds back the
  // rest of the page (dia.css), and the thank-you never pushes painted content down (CLS 0; Motion #228 M1).
  if (window.location.pathname === "/beta" && /^(mac-arm|mac-intel|windows)$/.test(new URLSearchParams(window.location.search).get("dl") ?? "")) {
    document.documentElement.setAttribute("data-dl", "");
  }
}

/** Runs inline in <head> (app/layout.tsx), before the first paint of a page loaded from the server. */
export const OS_BOOT = `(${applyOsClasses.toString()})()`;
