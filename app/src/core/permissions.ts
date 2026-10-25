/** Pure security decisions for the desktop agent, kept free of Electron so they can be tested. */

const APP_PAGE = /^file:\/\//i;

/** True only for frames that loaded Unvibe's own local renderer files. */
export function isTrustedSenderUrl(url: string | undefined | null): boolean {
  return typeof url === 'string' && APP_PAGE.test(url);
}

/** Renderer permission decision: clipboard writes, and microphone (audio only) for voice questions. */
export function allowPermission(permission: string, requestingUrl: string, mediaTypes: readonly string[] = []): boolean {
  if (!isTrustedSenderUrl(requestingUrl)) return false;
  if (permission === 'clipboard-sanitized-write') return true;
  if (permission === 'media') return mediaTypes.length > 0 && mediaTypes.every((type) => type === 'audio');
  return false;
}

/** Only HTTPS and mail links may leave the app for the default browser. */
export function isSafeExternalUrl(url: string): boolean {
  return /^https:\/\//i.test(url) || /^mailto:/i.test(url);
}

const BILLING_HOSTS: Record<string, true> = {
  'checkout.stripe.com': true,
  'billing.stripe.com': true,
  'unvibe.site': true,
  'api.unvibe.site': true,
};

/**
 * Checkout and billing-portal links come back from the server; only https links on Stripe's
 * checkout and billing hosts or Unvibe's own may open in the browser (Security F11, PR #52 audit).
 */
export function isBillingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port && BILLING_HOSTS[parsed.hostname] === true;
  } catch {
    return false;
  }
}
