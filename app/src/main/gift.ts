export const GIFT_LIMIT = 5;
const GIFT_CODE = /^[A-Za-z0-9_-]{16}$/;

/** A friend's gift code from what they pasted: the bare code or the whole ?ref= link. '' when neither. */
export function giftCodeFromInput(input: string): string {
  const trimmed = input.trim();
  if (GIFT_CODE.test(trimmed)) return trimmed;
  try {
    const ref = new URL(trimmed).searchParams.get('ref')?.trim() ?? '';
    return GIFT_CODE.test(ref) ? ref : '';
  } catch {
    return '';
  }
}

export function capGiftUsed(used: number): number {
  if (!Number.isFinite(used) || used < 0) return 0;
  return Math.min(GIFT_LIMIT, Math.floor(used));
}
