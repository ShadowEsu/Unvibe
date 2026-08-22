import { timingSafeEqual } from "node:crypto";

function founderControlToken(): string | null {
  return process.env.FOUNDER_CONTROL_TOKEN?.trim()
    || process.env.WAITLIST_ADMIN_TOKEN?.trim()
    || null;
}

function matches(expected: string, supplied: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length
    && timingSafeEqual(expectedBytes, suppliedBytes);
}

/**
 * Founder build control intentionally uses a short-lived browser passcode instead
 * of an OAuth account. The token is server-only; the client supplies it only when
 * the founder actively updates the public build signal.
 */
export async function verifyFounderRequest(request: Request): Promise<boolean> {
  const expected = founderControlToken();
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = request.headers.get("x-founder-control")?.trim() || bearer?.trim();
  return Boolean(expected && supplied && matches(expected, supplied));
}
