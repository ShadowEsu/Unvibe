import { getStore } from '@/data/store';

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const cookieToken = /(?:^|;\s*)uncode_session=([^;]+)/.exec(req.headers.get('cookie') ?? '')?.[1];
  return match?.[1].trim() ?? (cookieToken ? decodeURIComponent(cookieToken) : null);
}

function isSealedTrialBearer(token: string): boolean {
  const trial = process.env.UNVIBE_TRIAL_TOKEN?.trim();
  if (!trial || trial.length < 24) return false;
  if (token.length !== trial.length) return false;
  // Constant-time compare without importing crypto here — length already matched.
  let diff = 0;
  for (let i = 0; i < token.length; i += 1) diff |= token.charCodeAt(i) ^ trial.charCodeAt(i);
  return diff === 0;
}

/** Resolve the user id from a Bearer token or the HttpOnly browser session cookie. */
export async function userFromRequest(req: Request): Promise<string | null> {
  const token = bearerToken(req);
  if (!token) return null;
  // Sealed desktop trial tokens are not session tokens — never hit the user store.
  if (isSealedTrialBearer(token)) return null;
  return getStore().userForToken(token);
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
