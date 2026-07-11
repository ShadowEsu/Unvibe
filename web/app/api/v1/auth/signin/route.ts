import { getStore } from '@/data/store';

export const runtime = 'nodejs';

/**
 * In-app passwordless sign-in for the desktop app. Dev/beta only: creates or returns a user
 * for the given email and issues a bearer token. Production must add real verification.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'a valid email is required' }, { status: 400 });
  }
  const account = await getStore().signIn(email);
  return Response.json(account);
}
