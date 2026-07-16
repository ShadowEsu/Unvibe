import { cookies } from 'next/headers';
import { getStore } from '@/data/store';

export const runtime = 'nodejs';

function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  return match?.[1].trim() || null;
}

/** Revoke the current opaque session and clear the browser cookie. */
export async function POST(req: Request): Promise<Response> {
  const token = bearerToken(req) ?? cookies().get('uncode_session')?.value ?? null;
  cookies().set('uncode_session', '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'lax' });
  if (token) {
    await getStore().revokeToken(token);
  }
  return Response.json({ ok: true });
}
