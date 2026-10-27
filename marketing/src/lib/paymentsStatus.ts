import { webAppBackendUrl } from "@/lib/webAppBackend";

/** Seconds one answer is reused; matches the API's `s-maxage`. Page `revalidate` exports repeat it as a literal. */
export const PAYMENTS_STATUS_REVALIDATE_SECONDS = 300;

const TIMEOUT_MS = 2_500;

/**
 * Whether Pro checkout works right now, from the API's public
 * GET /api/v1/billing/status (its `checkoutOpen()`), so opening payments on the API flips the site
 * with no second edit. Fails closed: any error, timeout, non-2xx or unexpected body means closed,
 * because the closed copy is true either way while the open copy promises a checkout.
 */
export async function fetchPaymentsOpen(fetchImpl: typeof fetch = fetch, timeoutMs = TIMEOUT_MS): Promise<boolean> {
  try {
    const response = await fetchImpl(`${webAppBackendUrl()}/api/v1/billing/status`, {
      headers: { accept: "application/json" },
      next: { revalidate: PAYMENTS_STATUS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && "paymentsOpen" in body && body.paymentsOpen === true;
  } catch {
    return false;
  }
}
