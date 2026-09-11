import { applyGiftsForEmail } from '@/billing/gifts';
import { getStore } from '@/data/store';
import { withSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Sign in with email. Creates a session cookie for the web dashboard.
 * In dev, creates an account if one doesn't exist (passwordless convenience).
 * Production should gate behind UNCODE_ALLOW_DEV_EMAIL_AUTH or use device flow.
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
  const account = await getStore().signIn(email);
  if (account.email) await applyGiftsForEmail(account.email);
  return withSessionCookie(Response.json(account), account.token, req);
}
