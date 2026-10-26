import { createHash } from 'node:crypto';
import { getStore } from '@/data/store';

export function bearerToken(req: Request): string | null {
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

/** sha256 hex of a session token: account_deletions keeps these, never the token. */
export function sessionTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  userId: string;
  /** A deletion of this account has started (or finished while the token survived). */
  deleting: boolean;
}

/** The user behind a Bearer token or the HttpOnly browser session cookie, deletion included. */
export async function sessionUser(req: Request): Promise<SessionUser | null> {
  const token = bearerToken(req);
  if (!token) return null;
  // Sealed desktop trial tokens are not session tokens — never hit the user store.
  if (isSealedTrialBearer(token)) return null;
  const userId = await getStore().userForToken(token);
  if (!userId) return null;
  return { userId, deleting: (await getStore().accountDeletion(userId)) !== null };
}

/** Resolve the user id from a Bearer token or the session cookie. None for an account being deleted. */
export async function userFromRequest(req: Request): Promise<string | null> {
  const session = await sessionUser(req);
  return session && !session.deleting ? session.userId : null;
}

/** For routes that write: the user id, 401 without a session, or 410 while the account is being deleted. */
export async function userOrRefusal(req: Request, onUnauthorized: () => Response = unauthorized): Promise<string | Response> {
  const session = await sessionUser(req);
  if (!session) return onUnauthorized();
  return session.deleting ? accountDeleted() : session.userId;
}

export function baseUrlFrom(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

/** Nothing is created or written for an account that is being deleted or was deleted. */
export function accountDeleted(): Response {
  return Response.json({ error: 'account_deleted', message: 'This account was deleted or is being deleted.' }, { status: 410 });
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
