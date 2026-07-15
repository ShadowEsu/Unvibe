import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';

/** Revoke this desktop session before the app removes its encrypted local credentials. */
export async function POST(req: Request): Promise<Response> {
  const header = req.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (!token || !(await userFromRequest(req))) return unauthorized();
  await getStore().revokeToken(token);
  return Response.json({ ok: true });
}
