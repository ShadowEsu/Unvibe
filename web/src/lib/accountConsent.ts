/**
 * The agreement /activate asks for before an Unvibe app is signed in with an account: the Terms and
 * Privacy Policy, and being 18 or older (Google Gemini's API terms are 18+). The page asks with two
 * separate unticked boxes; /api/v1/auth/approve refuses without both, so a request that skips the
 * page still can't sign an app in. The version matches the app's consent screen (app/src/core/consent.ts).
 */
export const ACCOUNT_POLICY_VERSION = '2026-10-28';

export type AccountConsentKind = 'terms' | 'age_18';

export interface AccountAgreement {
  kinds: AccountConsentKind[];
  policyVersion: string;
}

/** Both boxes exactly `true` and the current version, or null. A string 'true' or a missing box is no agreement. */
export function accountAgreement(body: unknown): AccountAgreement | null {
  const agreement = (body as { agreement?: unknown } | null)?.agreement as
    | { terms?: unknown; age18?: unknown; policyVersion?: unknown }
    | undefined;
  if (!agreement || typeof agreement !== 'object') return null;
  if (agreement.terms !== true || agreement.age18 !== true) return null;
  if (agreement.policyVersion !== ACCOUNT_POLICY_VERSION) return null;
  return { kinds: ['terms', 'age_18'], policyVersion: ACCOUNT_POLICY_VERSION };
}

/** Rows go to public.consents only once Preston has applied that migration and set CONSENTS_TABLE=on. */
export function consentsTableOn(): boolean {
  return process.env.CONSENTS_TABLE === 'on';
}
