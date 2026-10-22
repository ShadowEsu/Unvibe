import { getStore } from '@/data/store';
import { withSessionCookie } from '@/lib/auth';
import { devEmailAuthDisabledResponse, devEmailAuthEnabled } from '@/lib/devEmailAuth';

export const runtime = 'nodejs';

/**
 * Sign in with email (local development only, see devEmailAuthEnabled). Creates a session cookie
 * for the web dashboard, and an account if one doesn't exist (passwordless convenience).
 */
export async function POST(req: Request): Promise<Response> {
  if (!devEmailAuthEnabled()) return devEmailAuthDisabledResponse();
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'a valid email is required' }, { status: 400 });
  }
  const account = await getStore().signIn(email);
  return withSessionCookie(Response.json(account), account.token, req);
}
