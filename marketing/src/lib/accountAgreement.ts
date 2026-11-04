/**
 * What /activate and /redeem ask before any sign-in starts: the Terms and Privacy Policy, and 18
 * or older (Unvibe's Terms are 18+), as two separate unticked boxes. The API refuses an approve or
 * a redemption without both and this version (web/src/lib/accountConsent.ts, which marketing can't
 * import; accountAgreement.test.ts checks the two match. The app's consent screen uses the same one).
 */
export const ACCOUNT_POLICY_VERSION = "2026-11-05";

/** Each page keeps its own ticks: a box ticked on one page never comes back ticked on the other. */
export const ACTIVATE_AGREEMENT_KEY = "unvibe_activate_agreement";
export const REDEEM_AGREEMENT_KEY = "unvibe_redeem_agreement";
type AgreementKey = typeof ACTIVATE_AGREEMENT_KEY | typeof REDEEM_AGREEMENT_KEY;

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface AgreementTicks {
  terms: boolean;
  age18: boolean;
}

/** The `agreement` the API checks: both boxes exactly true at the current version. */
export interface AccountAgreement {
  terms: true;
  age18: true;
  policyVersion: string;
}

/** The agreement to send, only when both boxes are ticked; null until then. */
export function agreementPayload(ticks: AgreementTicks): AccountAgreement | null {
  return ticks.terms === true && ticks.age18 === true ? { terms: true, age18: true, policyVersion: ACCOUNT_POLICY_VERSION } : null;
}

function store(storage: SessionStore | null, action: (s: SessionStore) => void): void {
  try {
    if (storage) action(storage);
  } catch {
    // Storage blocked (private mode, policies): the boxes are asked again after the round trip.
  }
}

/** The ticks this page saved before the Google or email round trip, for this policy version only. */
export function storedAgreement(key: AgreementKey, storage: SessionStore | null): AgreementTicks {
  let saved: { v?: unknown; terms?: unknown; age18?: unknown } | null = null;
  store(storage, (s) => {
    try {
      saved = JSON.parse(s.getItem(key) ?? "null");
    } catch {
      saved = null;
    }
  });
  const value = saved as { v?: unknown; terms?: unknown; age18?: unknown } | null;
  if (value?.v !== ACCOUNT_POLICY_VERSION) return { terms: false, age18: false };
  return { terms: value.terms === true, age18: value.age18 === true };
}

/** Keeps the person's own ticks for the round trip; both unticked forgets them. */
export function saveAgreement(key: AgreementKey, ticks: AgreementTicks, storage: SessionStore | null): void {
  store(storage, (s) => {
    if (ticks.terms || ticks.age18) s.setItem(key, JSON.stringify({ v: ACCOUNT_POLICY_VERSION, terms: ticks.terms, age18: ticks.age18 }));
    else s.removeItem(key);
  });
}
