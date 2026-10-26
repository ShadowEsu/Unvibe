import { userOrRefusal } from '@/lib/auth';

/** 401 without a session, 410 while the account is being deleted (nothing is written for it). */
export function requireUser(req: Request): Promise<string | Response> {
  return userOrRefusal(req, () => Response.json({ error: 'unauthorized', message: 'Sign in to continue.' }, { status: 401 }));
}

// Provider and configuration text (Stripe errors, env names, key mode) must never reach the
// client: it reveals how billing is set up. 5xx answers are always generic; 4xx store messages
// such as "Add a paid seat before sending another invitation." still tell the user what to do.
const INTERNAL_DETAIL = /stripe|STRIPE_|SUPABASE|cus_|sub_|price_|live mode|test mode|secret|api key|not configured/i;
const GENERIC_MESSAGE = 'Billing is unavailable right now. Try again shortly.';

/**
 * What may be logged or stored about a billing failure. A Stripe error is reduced to its class, type
 * and code: Stripe's message can quote customer, price and key details. Our own errors keep their
 * message (it is fixed text written here), so a failed webhook still says what went wrong.
 */
export function errorSummary(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  // Stripe's SDK errors carry their class name in `type` and the API's error type in `rawType`.
  const { type, rawType, code } = error as Error & { type?: unknown; rawType?: unknown; code?: unknown };
  if (typeof type === 'string' && type.startsWith('Stripe')) {
    return [type, rawType, code].filter((part): part is string => typeof part === 'string').join(' ');
  }
  return `${error.name}: ${error.message}`.slice(0, 500);
}

export function billingError(error: unknown, status = 400): Response {
  const raw = error instanceof Error ? error.message : '';
  const safe = status < 500 && raw !== '' && !INTERNAL_DETAIL.test(raw);
  if (!safe) console.error('billing error', errorSummary(error));
  return Response.json({ error: 'billing_error', message: safe ? raw : GENERIC_MESSAGE }, { status });
}

export function isResponse(value: string | Response): value is Response {
  return value instanceof Response;
}
