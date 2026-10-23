import { getStore } from '@/data/store';
import { withSessionCookie } from '@/lib/auth';
import { devEmailAuthDisabledResponse, devEmailAuthEnabled } from '@/lib/devEmailAuth';

export const runtime = 'nodejs';

/**
 * Create a new account with email (local development only, see devEmailAuthEnabled). Passwordless;
 * the Store's signUp enforces the account-not-exists check. Sets a session cookie on success.
 */
export async function POST(req: Request): Promise<Response> {
  if (!devEmailAuthEnabled()) return devEmailAuthDisabledResponse();
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'a valid email is required' }, { status: 400 });
  }
  const result = await getStore().signUp(email);
  if (!result) {
    return Response.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 409 });
  }
  return withSessionCookie(Response.json(result), result.token, req);
}
