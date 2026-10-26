import { createHash } from 'node:crypto';

/**
 * Promo codes: 16 characters of Crockford base32 (80 random bits), shown as XXXX-XXXX-XXXX-XXXX.
 * The database stores only sha256("unvibe-promo:" + normalised code) in hex, never the code.
 * scripts/promo-batch.mjs generates codes and hashes with the same rules (test/promoCode.test.ts
 * checks they agree).
 */

export const PROMO_CODE_LENGTH = 16;
export const PROMO_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PROMO_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
/** Longer input is rejected before any work: no real code, even typed with spaces, gets near it. */
const MAX_INPUT = 64;

/**
 * Upper case, whitespace and hyphens dropped, O read as 0, I and L read as 1. Null unless the
 * result is exactly 16 Crockford base32 characters.
 */
export function normalisePromoCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_INPUT) return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return PROMO_RE.test(code) ? code : null;
}

/** Lowercase hex sha256 of "unvibe-promo:" + the normalised code: what promo_codes stores. */
export function promoCodeHash(normalised: string): string {
  return createHash('sha256').update(`unvibe-promo:${normalised}`).digest('hex');
}

/** XXXX-XXXX-XXXX-XXXX for a normalised code. */
export function formatPromoCode(normalised: string): string {
  return normalised.match(/.{1,4}/g)?.join('-') ?? normalised;
}
