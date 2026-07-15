import { getStore } from '@/data/store';

/** Resolve the user id from a Bearer token, or null. */
export async function userFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return null;
  }
  return getStore().userForToken(match[1].trim());
}

export function baseUrlFrom(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

/** Set the session cookie on a response. Uses HttpOnly for security, no Secure in local dev. */
export function withSessionCookie(res: Response, token: string, req: Request): Response {
  const isHttps = new URL(req.url).protocol === 'https:' || process.env.NODE_ENV === 'production';
  const cookie =
    `uncode_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` +
    (isHttps ? '; Secure' : '');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: { ...Object.fromEntries(res.headers), 'set-cookie': cookie },
  });
}
