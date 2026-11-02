/**
 * Build the one-time browser URL without ever treating an OAuth callback as a device code.
 *
 * The page is pinned to the API the app signs in with: same origin as `backend` and the `/activate` path
 * (Security LOW, 1.0 plan item 8). The service builds it from its own origin, so anything else means the
 * response was not the service's, and the app must not open it with a valid user code attached.
 */
export function deviceVerificationUrl(verificationUri: string, userCode: string, backend: string): string {
  const url = new URL(verificationUri);
  if (url.protocol !== 'https:') throw new Error('Secure sign-in requires an HTTPS verification page.');
  if (url.origin !== new URL(backend).origin || url.pathname.replace(/\/+$/, '') !== '/activate') {
    throw new Error("The sign-in page is not on Unvibe's service.");
  }
  url.searchParams.set('user_code', userCode);
  return url.toString();
}
