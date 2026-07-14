import { getStore } from '@/data/store';

export const runtime = 'nodejs';

/**
 * Development-only convenience sign-in. It must never become production authentication:
 * production builds require the configured verified device/auth flow before issuing a token.
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
  return Response.json(account);
}
