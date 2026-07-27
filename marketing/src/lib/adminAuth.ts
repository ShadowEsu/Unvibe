import { timingSafeEqual } from "node:crypto";

function configuredAdminToken(): string | null {
  const token = process.env.WAITLIST_ADMIN_TOKEN?.trim();
  return token || null;
}

/**
 * Waitlist entries contain personal data. The founder view must require the
 * server-only token, rather than relying on an unlinked URL as a secret.
 */
export function isWaitlistAdminAuthorized(authorization: string | null): boolean {
  const token = configuredAdminToken();
  if (!token || !authorization?.startsWith("Bearer ")) return false;

  const provided = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(token);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function waitlistAdminOpenAccess(): boolean {
  return false;
}
