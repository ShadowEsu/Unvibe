import { userFromRequest } from '@/lib/auth';

export async function requireUser(req: Request): Promise<string | Response> {
  const userId = await userFromRequest(req);
  return userId ?? Response.json({ error: 'unauthorized', message: 'Sign in to continue.' }, { status: 401 });
}

// Provider and configuration text (Stripe errors, env names, key mode) must never reach the
// client: it reveals how billing is set up. 5xx answers are always generic; 4xx store messages
// such as "Add a paid seat before sending another invitation." still tell the user what to do.
const INTERNAL_DETAIL = /stripe|STRIPE_|SUPABASE|cus_|sub_|price_|live mode|test mode|secret|api key|not configured/i;
const GENERIC_MESSAGE = 'Billing is unavailable right now. Try again shortly.';

export function billingError(error: unknown, status = 400): Response {
  const raw = error instanceof Error ? error.message : '';
  const safe = status < 500 && raw !== '' && !INTERNAL_DETAIL.test(raw);
  if (!safe) console.error('billing error', error);
  return Response.json({ error: 'billing_error', message: safe ? raw : GENERIC_MESSAGE }, { status });
}

export function isResponse(value: string | Response): value is Response {
  return value instanceof Response;
}
