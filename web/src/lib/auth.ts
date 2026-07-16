import { getStore } from '@/data/store';

/** Resolve the user id from a Bearer token or the HttpOnly browser session cookie. */
export async function userFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const cookieToken = /(?:^|;\s*)uncode_session=([^;]+)/.exec(req.headers.get('cookie') ?? '')?.[1];
  const token = match?.[1].trim() ?? (cookieToken ? decodeURIComponent(cookieToken) : null);
  return token ? getStore().userForToken(token) : null;
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
    `uncode_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` +
    (isHttps ? '; Secure' : '');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: { ...Object.fromEntries(res.headers), 'set-cookie': cookie },
  });
}
