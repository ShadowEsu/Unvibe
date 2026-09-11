import { getStore } from '@/data/store';
import { getBillingStore } from '@/billing/store';
import { userFromRequest, unauthorized } from '@/lib/auth';
import type { IncomingEvent } from '@/data/types';
import { isIncomingEvent } from '@/data/eventValidation';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  const body = (await req.json().catch(() => null)) as { events?: IncomingEvent[]; workspaceId?: unknown } | null;
  if (!body || !Array.isArray(body.events)) {
    return Response.json({ error: 'missing events[]' }, { status: 400 });
  }
  if (body.events.length > 500 || !body.events.every(isIncomingEvent)) {
    return Response.json({ error: 'events must contain at most 500 valid activity records' }, { status: 400 });
  }

  const billing = getBillingStore();
  let workspaceId: string | undefined;
  if (typeof body.workspaceId === 'string' && body.workspaceId.trim()) {
    const access = await billing.getWorkspaceAccess(userId, body.workspaceId.trim());
    if (!access) {
      return Response.json({ error: 'forbidden', message: 'Not a member of that workspace.' }, { status: 403 });
    }
    workspaceId = access.id;
  } else {
    const personal = await billing.ensurePersonalWorkspace(userId);
    workspaceId = personal.id;
  }

  await getStore().upsertEvents(userId, body.events, workspaceId);
  return Response.json({ ok: true, count: body.events.length, workspaceId });
}
