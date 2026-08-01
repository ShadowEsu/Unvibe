import { userFromRequest } from '@/lib/auth';

export async function requireUser(req: Request): Promise<string | Response> {
  const userId = await userFromRequest(req);
  return userId ?? Response.json({ error: 'unauthorized', message: 'Sign in to continue.' }, { status: 401 });
}

export function billingError(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : 'Billing request failed.';
  return Response.json({ error: 'billing_error', message }, { status });
}

export function isResponse(value: string | Response): value is Response {
  return value instanceof Response;
}
