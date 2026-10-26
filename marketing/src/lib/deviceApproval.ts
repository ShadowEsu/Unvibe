/**
 * The device code on /activate. The Unvibe app opens /activate?user_code=… so the code is
 * filled in for the person, but anyone can send such a link (device-code phishing). A code
 * that arrived in a link is remembered as such across the sign-in redirect, so the page keeps
 * asking the person to check it against their app until they approve.
 */

const CODE_KEY = "unvibe_device_user_code";
const FROM_LINK_KEY = "unvibe_device_code_from_link";
const URL_PARAMS = ["user_code", "device", "device_code"] as const;
/** Also part of a sign-in: Supabase's return from Google or the email link (`code`, or `error`). */
const SIGN_IN_PARAMS = [...URL_PARAMS, "code", "error"] as const;

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface PendingDeviceCode {
  code: string;
  /** True when the code came from a link rather than being typed on this page. */
  fromLink: boolean;
  /** The page's query string without the device code, for history.replaceState. Null when unchanged. */
  cleanSearch: string | null;
}

function store(storage: SessionStore | null, action: (s: SessionStore) => void): void {
  try {
    if (storage) action(storage);
  } catch {
    // Storage blocked (private mode, policies): the code lives in page state only.
  }
}

/**
 * True when /activate opened as part of a sign-in (the app's link with a device code, or the
 * return from Google or the email link), so the page shows today's sign-in steps straight away.
 * False for a visitor who arrived without the app: they see the download first.
 */
export function opensForSignIn(searchParams: Record<string, string | string[] | undefined>): boolean {
  return SIGN_IN_PARAMS.some((name) => {
    const value = searchParams[name];
    return (Array.isArray(value) ? value : [value]).some((v) => Boolean(v?.trim()));
  });
}

/** Reads the code from the /activate URL, or the one saved before a sign-in redirect. */
export function pendingDeviceCode(search: string, storage: SessionStore | null): PendingDeviceCode {
  const params = new URLSearchParams(search);
  const fromUrl = URL_PARAMS.map((name) => params.get(name)).find(Boolean)?.trim().toUpperCase();
  if (fromUrl) {
    store(storage, (s) => {
      s.setItem(CODE_KEY, fromUrl);
      s.setItem(FROM_LINK_KEY, "1");
    });
    for (const name of URL_PARAMS) params.delete(name);
    const rest = params.toString();
    return { code: fromUrl, fromLink: true, cleanSearch: rest ? `?${rest}` : "" };
  }
  let code = "";
  let fromLink = false;
  store(storage, (s) => {
    code = s.getItem(CODE_KEY) ?? "";
    fromLink = Boolean(code) && s.getItem(FROM_LINK_KEY) === "1";
  });
  return { code, fromLink, cleanSearch: null };
}

/** Saves the code before leaving for Google or the email link. A typed code is not a link code. */
export function saveDeviceCode(code: string, fromLink: boolean, storage: SessionStore | null): void {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  store(storage, (s) => {
    s.setItem(CODE_KEY, normalized);
    if (fromLink) s.setItem(FROM_LINK_KEY, "1");
    else s.removeItem(FROM_LINK_KEY);
  });
}

/** Forgets the code once it was approved. */
export function clearDeviceCode(storage: SessionStore | null): void {
  store(storage, (s) => {
    s.removeItem(CODE_KEY);
    s.removeItem(FROM_LINK_KEY);
  });
}
