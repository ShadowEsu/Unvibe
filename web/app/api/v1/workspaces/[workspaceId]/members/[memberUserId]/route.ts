import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { workspaceId: string; memberUserId: string } }): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const body = (await req.json()) as { role?: unknown };
    if (body.role !== 'admin' && body.role !== 'member') return Response.json({ error: 'invalid_role' }, { status: 400 });
    const billing = getBillingStore();
    await billing.changeMemberRole(user, params.workspaceId, params.memberUserId, body.role);
    await billing.recordAudit(user, params.workspaceId, 'member.role_changed', { memberUserId: params.memberUserId, role: body.role });
    return Response.json({ ok: true });
  } catch (error) { return billingError(error, 403); }
}

export async function DELETE(req: Request, { params }: { params: { workspaceId: string; memberUserId: string } }): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const billing = getBillingStore();
    await billing.removeMember(user, params.workspaceId, params.memberUserId);
    await billing.recordAudit(user, params.workspaceId, 'member.removed', { memberUserId: params.memberUserId });
    return new Response(null, { status: 204 });
  } catch (error) { return billingError(error, 403); }
}
