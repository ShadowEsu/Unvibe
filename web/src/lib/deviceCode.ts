/**
 * The device code on /activate. The Unvibe app opens /activate?user_code=… so the code is
 * filled in for the person, but anyone can send such a link (device-code phishing). A code
 * that arrived in a link is remembered as such across the sign-in redirect and the emailed
 * sign-in link (another tab), so the page keeps asking the person to check it against their
 * app until they approve.
 */

const KEY = 'unvibe_device_user_code';
const TTL_MS = 15 * 60_000;
const URL_PARAMS = ['user_code', 'device', 'device_code'] as const;

type CodeStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface PendingDeviceCode {
  code: string;
  /** True when the code came from a link rather than being typed on this page. */
  fromLink: boolean;
  /** The page's query string without the device code, for history.replaceState. Null when unchanged. */
  cleanSearch: string | null;
}

/** Remember the code across tabs so an emailed sign-in link can still finish approval. */
export function saveDeviceCode(code: string, fromLink: boolean, storage: CodeStore | null, now = Date.now()): void {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  try {
    storage?.setItem(KEY, JSON.stringify({ code: normalized, fromLink, at: now }));
  } catch {
    /* storage blocked: the code stays in the field for this tab */
  }
}

/** Reads the code from the /activate URL (never the OAuth ?code=), or the one saved earlier. */
export function pendingDeviceCode(search: string, storage: CodeStore | null, now = Date.now()): PendingDeviceCode {
  const params = new URLSearchParams(search);
  const fromUrl = URL_PARAMS.map((name) => params.get(name)).find(Boolean)?.trim().toUpperCase();
  if (fromUrl) {
    saveDeviceCode(fromUrl, true, storage, now);
    for (const name of URL_PARAMS) params.delete(name);
    const rest = params.toString();
    return { code: fromUrl, fromLink: true, cleanSearch: rest ? `?${rest}` : '' };
  }
  try {
    const raw = storage?.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as { code?: unknown; fromLink?: unknown; at?: unknown }) : null;
    if (saved && typeof saved.code === 'string' && saved.code && typeof saved.at === 'number' && now - saved.at <= TTL_MS) {
      return { code: saved.code, fromLink: saved.fromLink === true, cleanSearch: null };
    }
  } catch {
    /* storage blocked or unreadable: nothing remembered */
  }
  return { code: '', fromLink: false, cleanSearch: null };
}

/** Forgets the code once it was approved. */
export function clearDeviceCode(storage: CodeStore | null): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
