import { createHash, randomBytes } from 'node:crypto';

export const GIFT_LIMIT = 5;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function giftCodeFromEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 8);
}

export function randomGiftCode(bytes: Uint8Array = randomBytes(8)): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  return out;
}

export function capGiftUsed(used: number): number {
  if (!Number.isFinite(used) || used < 0) return 0;
  return Math.min(GIFT_LIMIT, Math.floor(used));
}
