import { createHash } from 'node:crypto';

export const GIFT_LIMIT = 5;
export const GIFT_MONTHS = 1;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function giftCodeFromEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 8);
}

export function normalizeGiftCode(code: string): string {
  return code.trim().toLowerCase();
}

export function isVerifiableGiftCode(code: string): boolean {
  return /^[a-f0-9]{8}$/.test(normalizeGiftCode(code));
}

export function giftCodeMatchesEmail(email: string, code: string): boolean {
  return isVerifiableGiftCode(code) && giftCodeFromEmail(email) === normalizeGiftCode(code);
}

export function isGiftSubscriptionId(id?: string): boolean {
  return Boolean(id?.startsWith('gift:'));
}
