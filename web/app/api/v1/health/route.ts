import { billingMode, webhookConfigured } from '@/billing/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public liveness. Billing reports only whether checkout is `off`, `test` or `live` and whether the
 * webhook can verify events (Security L4), so a deploy can be checked from outside. Never reports a
 * key, a secret, a price id, any other provider configuration or user data.
 */
export async function GET(): Promise<Response> {
  return Response.json(
    { ok: true, service: 'unvibe-api', version: 'v1', billing: billingMode(), webhookConfigured: webhookConfigured() },
    { headers: { 'cache-control': 'no-store' } },
  );
}
