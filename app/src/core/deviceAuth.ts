/** Build the one-time browser URL without ever treating an OAuth callback as a device code. */
export function deviceVerificationUrl(verificationUri: string, userCode: string): string {
  const url = new URL(verificationUri);
  if (url.protocol !== 'https:') throw new Error('Secure sign-in requires an HTTPS verification page.');
  url.searchParams.set('user_code', userCode);
  return url.toString();
}
