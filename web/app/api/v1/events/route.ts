import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';
import type { IncomingEvent } from '@/data/types';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  const body = (await req.json().catch(() => null)) as { events?: IncomingEvent[] } | null;
  if (!body || !Array.isArray(body.events)) {
    return Response.json({ error: 'missing events[]' }, { status: 400 });
  }
  await getStore().upsertEvents(userId, body.events);
  return Response.json({ ok: true, count: body.events.length });
}
