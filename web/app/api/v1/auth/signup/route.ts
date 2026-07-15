import { getStore } from '@/data/store';
import { withSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Create a new account with email. In dev MemoryStore this is passwordless;
 * in production the Store's signUp method enforces the account-not-exists check.
 * Sets a session cookie for the web dashboard on success.
 */
export async function POST(req: Request): Promise<Response> {
  const enabled = process.env.NODE_ENV !== 'production' || process.env.UNCODE_ALLOW_DEV_EMAIL_AUTH === 'true';
  if (!enabled) {
    return Response.json({ error: 'Cloud sign-in is not configured for this build. Use local-only mode or configure verified authentication.' }, { status: 501 });
  }
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
