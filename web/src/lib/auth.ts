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
