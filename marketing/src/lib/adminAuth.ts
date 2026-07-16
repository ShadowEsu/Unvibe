import { timingSafeEqual } from "node:crypto";

export function isWaitlistAdminAuthorized(authorization: string | null): boolean {
  const expected = process.env.WAITLIST_ADMIN_TOKEN?.trim();
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice("Bearer ".length).trim();
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
