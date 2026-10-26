/**
 * /redeem: promo codes for Pro months. The API (api.unvibe.site/api/v1/promo/redeem) decides
 * everything; this file only reads codes the way the API does, keeps a code across the sign-in
 * redirect, and turns the API's answer into one line for the page.
 *
 * Codes are 16 characters of Crockford base32, shown as XXXX-XXXX-XXXX-XXXX. The API normalises
 * them with the same rules as normalisePromoCode below (web/src/lib/promoCode.ts).
 */

const PROMO_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
const STORAGE_KEY = "unvibe_promo_code";

/** Upper case, whitespace and hyphens dropped, O read as 0, I and L read as 1. Null unless 16 Crockford characters. */
export function normalisePromoCode(raw: string): string | null {
  if (raw.length > 64) return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  return PROMO_RE.test(code) ? code : null;
}

/** What the code field shows while someone types or pastes: upper case, groups of four, at most 16 characters. */
export function formatCodeInput(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 16);
  return chars.match(/.{1,4}/g)?.join("-") ?? "";
}

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(storage: SessionStore | null, action: (s: SessionStore) => void): void {
  try {
    if (storage) action(storage);
  } catch {
    // Storage blocked: the code lives in page state only.
  }
}

export interface PendingPromo {
  /** The code to show in the field, formatted, or "". */
  code: string;
  /** A Supabase sign-in code (Google or email link, PKCE) to exchange for a session, or null. */
  authCode: string | null;
  /** The query string without `promo` and `code`, for history.replaceState. Null when unchanged. */
  cleanSearch: string | null;
}

/**
 * Reads /redeem's query: `?promo=` is a prefilled promo code (from a shared link); `?code=` is
 * only ever Supabase's sign-in code after the Google or email-link redirect. A promo code is kept
 * in session storage so it survives that redirect. Both leave the address bar.
 */
export function pendingPromoCode(search: string, storage: SessionStore | null): PendingPromo {
  const params = new URLSearchParams(search);
  const fromLink = params.get("promo")?.trim() ?? "";
  const promo = fromLink ? normalisePromoCode(fromLink) : null;
  if (promo) store(storage, (s) => s.setItem(STORAGE_KEY, promo));
  const authCode = params.get("code")?.trim() || null;
  let saved = "";
  store(storage, (s) => {
    saved = s.getItem(STORAGE_KEY) ?? "";
  });
  const known = promo ?? normalisePromoCode(saved);
  // A malformed link code is still shown, so the person can see and fix it.
  const code = known ? formatCodeInput(known) : formatCodeInput(fromLink);
  if (!params.has("promo") && !params.has("code")) return { code, authCode, cleanSearch: null };
  params.delete("promo");
  params.delete("code");
  const rest = params.toString();
  return { code, authCode, cleanSearch: rest ? `?${rest}` : "" };
}

/** Keeps a typed code before leaving for Google or the email link. */
export function savePromoCode(code: string, storage: SessionStore | null): void {
  const promo = normalisePromoCode(code);
  if (promo) store(storage, (s) => s.setItem(STORAGE_KEY, promo));
}

/** Forgets the code once the API has answered for good. */
export function clearPromoCode(storage: SessionStore | null): void {
  store(storage, (s) => s.removeItem(STORAGE_KEY));
}

export type RedeemOutcomeKind =
  | "redeemed"
  | "already_yours"
  | "bad_code"
  | "invalid"
  | "used"
  | "one_per_account"
  | "has_paid_plan"
  | "expired"
  | "cap_reached"
  | "signed_out"
  | "rate_limited"
  | "unavailable";

export interface RedeemOutcome {
  kind: RedeemOutcomeKind;
  ok: boolean;
  /** The one line the page shows. */
  line: string;
  /** Redeemed or already on the account: show the download and "sign in with the same account". */
  showDownload: boolean;
  /** The API has answered for good: the saved code can be forgotten. */
  final: boolean;
}

/** "January 24, 2027" in the reader's time zone (a fixed one in tests). */
export function formatProUntil(iso: string, timeZone?: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone }).format(date);
}

type ErrorKind = Exclude<RedeemOutcomeKind, "redeemed" | "already_yours">;

/** One line per answer. `final`: the API has decided about this code, so the saved code is forgotten. */
const ERRORS: Record<ErrorKind, { line: string; final: boolean }> = {
  bad_code: { line: "That code does not look right. Codes have 16 letters and numbers, like ABCD-EFGH-JKMN-PQRS.", final: false },
  invalid: { line: "That code was not found. Check it and try again.", final: true },
  used: { line: "That code has already been used by another account.", final: true },
  one_per_account: { line: "This account already used a code from this offer.", final: true },
  has_paid_plan: { line: "You already have a paid plan, so the code was not used.", final: true },
  expired: { line: "That code has expired.", final: true },
  cap_reached: { line: "Every code from this offer has been claimed.", final: true },
  signed_out: { line: "Your sign-in has expired. Sign in again, then redeem.", final: false },
  rate_limited: { line: "Too many tries. Wait a minute and try again.", final: false },
  unavailable: { line: "Codes cannot be redeemed right now. Try again shortly.", final: false },
};

function isErrorKind(value: unknown): value is ErrorKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ERRORS, value);
}

/** The page's line for an answer from /api/redeem (the API's answer, or the proxy's own 403/415/429/503). */
export function redeemOutcome(httpStatus: number, body: unknown, timeZone?: string): RedeemOutcome {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const until = typeof data.proUntil === "string" ? formatProUntil(data.proUntil, timeZone) : null;
  const untilLine = until ? ` Pro until ${until}.` : "";
  if (httpStatus === 200 && data.status === "redeemed") {
    const months = typeof data.months === "number" && data.months > 0 ? data.months : null;
    const added = months ? `${months} ${months === 1 ? "month" : "months"} of Pro added.` : "Pro added.";
    return { kind: "redeemed", ok: true, line: `${added}${untilLine}`, showDownload: true, final: true };
  }
  if (httpStatus === 200 && data.status === "already_yours") {
    return { kind: "already_yours", ok: true, line: `This code is already on your account.${untilLine}`, showDownload: true, final: true };
  }
  const kind: ErrorKind = isErrorKind(data.error)
    ? data.error
    : httpStatus === 401 ? "signed_out" : httpStatus === 429 ? "rate_limited" : "unavailable";
  return { kind, ok: false, line: ERRORS[kind].line, showDownload: false, final: ERRORS[kind].final };
}
