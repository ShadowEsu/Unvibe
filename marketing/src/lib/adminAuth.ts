import { timingSafeEqual } from "node:crypto";

function configuredToken(): string {
  return process.env.WAITLIST_ADMIN_TOKEN?.trim() ?? "";
}

/**
 * Administrative waitlist data is private. Access is denied until a production
 * token is configured, then granted only to a matching Bearer credential.
 */
export function isWaitlistAdminAuthorized(authorization: string | null): boolean {
  const token = configuredToken();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const suppliedToken = match?.[1]?.trim() ?? "";

  if (!token || !suppliedToken) return false;

  const expected = Buffer.from(token);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function waitlistAdminOpenAccess(): boolean {
  return false;
}
