/**
 * /waitlist is an obscure founder URL (not linked publicly).
 * No access key gate — visibility is the secret path, not a password.
 */
export function isWaitlistAdminAuthorized(_authorization: string | null): boolean {
  return true;
}

export function waitlistAdminOpenAccess(): boolean {
  return true;
}
