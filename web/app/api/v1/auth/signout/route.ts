import { cookies } from 'next/headers';

export const runtime = 'nodejs';

/**
 * Clear the session cookie. The token remains valid in the store until it expires or
 * the user signs in again (token revocation is a future enhancement).
 */
export async function POST(): Promise<Response> {
  cookies().set('uncode_session', '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'lax' });
  return Response.json({ ok: true });
}
