import { checkoutOpen } from '@/billing/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public: whether Pro and Teams checkout works right now. unvibe.site reads this so its pricing
 * copy only promises what checkout does. One boolean, no sign-in, nothing about configuration.
 */
export async function GET(): Promise<Response> {
  return Response.json(
    { paymentsOpen: checkoutOpen() },
    { headers: { 'cache-control': 'public, s-maxage=300' } },
  );
}
