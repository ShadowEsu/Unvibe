/** Stripe's hosted Checkout and customer portal: the only places /plan sends a browser to. */
const STRIPE_HOSTS = new Set(['checkout.stripe.com', 'billing.stripe.com']);

/**
 * The checkout and portal routes answer with a Stripe session URL. /plan follows it only when it is
 * HTTPS on one of Stripe's hosted hosts (Security X-U36), so a wrong or tampered answer can't send
 * a signed-in person to another site. Null means "don't navigate".
 */
export function stripeRedirect(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return null;
    return STRIPE_HOSTS.has(parsed.hostname) ? parsed.href : null;
  } catch {
    return null;
  }
}
