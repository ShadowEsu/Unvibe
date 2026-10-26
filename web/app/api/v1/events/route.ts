import { getStore } from '@/data/store';
import { getBillingStore } from '@/billing/store';
import { userOrRefusal } from '@/lib/auth';
import type { IncomingEvent } from '@/data/types';
import { isIncomingEvent } from '@/data/eventValidation';
import { EventOwnershipError } from '@/data/eventOwnership';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const userId = await userOrRefusal(req);
  if (typeof userId !== 'string') return userId;
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

  try {
    await getStore().upsertEvents(userId, body.events, workspaceId);
  } catch (error) {
    if (error instanceof EventOwnershipError) {
      return Response.json({ error: 'event_conflict', message: error.message, eventIds: error.eventIds }, { status: 409 });
    }
    throw error;
  }
  return Response.json({ ok: true, count: body.events.length, workspaceId });
}
