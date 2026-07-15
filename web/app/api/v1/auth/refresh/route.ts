import { getStore } from '@/data/store';

export const runtime = 'nodejs';

/**
 * Rotates a desktop refresh token. The client stores it only in Electron safeStorage;
 * this endpoint never accepts an access token as a refresh credential.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { refreshToken?: string };
  if (!body.refreshToken) return Response.json({ error: 'missing refresh token' }, { status: 400 });
  const session = await getStore().refreshSession(body.refreshToken);
  if (!session) return Response.json({ error: 'session expired or revoked' }, { status: 401 });
  return Response.json(session);
}
