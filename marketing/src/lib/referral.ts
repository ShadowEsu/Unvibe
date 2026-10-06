/** The friend's referral code from a ?ref= link, remembered across pages until it is used. */

const KEY = "unvibe.ref";
const USED_KEY = "unvibe.refUsed";
const CODE = /^[a-f0-9]{8}$/;

export function rememberRef(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref")?.trim().toLowerCase() ?? "";
    if (CODE.test(ref)) window.localStorage.setItem(KEY, ref);
  } catch {
    /* storage blocked: the link still works on this page through the URL */
  }
}

export function storedRef(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref")?.trim().toLowerCase() ?? "";
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
