/**
 * The friend's code from a ?ref= link, remembered across pages until it is used. It is either an
 * app gift code (16 characters, case-sensitive; the friend enters it in the app to get Pro) or a
 * legacy 8 character waitlist code, which is kept for attribution only.
 */

const KEY = "unvibe.ref";
const USED_KEY = "unvibe.refUsed";
const CODE = /^([a-f0-9]{8}|[A-Za-z0-9_-]{16})$/;
export const GIFT_CODE = /^[A-Za-z0-9_-]{16}$/;

export function rememberRef(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref")?.trim() ?? "";
    if (CODE.test(ref)) window.localStorage.setItem(KEY, ref);
  } catch {
    /* storage blocked: the link still works on this page through the URL */
  }
}

export function storedRef(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref")?.trim() ?? "";
    if (CODE.test(fromUrl)) return fromUrl;
    const saved = window.localStorage.getItem(KEY) ?? "";
    return CODE.test(saved) ? saved : "";
  } catch {
    return "";
  }
}

/** True once this browser has joined with the friend's code, so we stop asking. */
export function refUsed(): boolean {
  try { return window.localStorage.getItem(USED_KEY) === "1"; } catch { return false; }
}

export function markRefUsed(): void {
  try { window.localStorage.setItem(USED_KEY, "1"); } catch { /* storage blocked */ }
}
