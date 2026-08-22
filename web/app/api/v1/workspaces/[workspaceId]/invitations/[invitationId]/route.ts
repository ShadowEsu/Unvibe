import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';

export async function DELETE(req: Request, { params }: { params: { workspaceId: string; invitationId: string } }): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const billing = getBillingStore();
    await billing.revokeInvitation(user, params.workspaceId, params.invitationId);
    await billing.recordAudit(user, params.workspaceId, 'invitation.revoked', { invitationId: params.invitationId });
    return new Response(null, { status: 204 });
  } catch (error) { return billingError(error, 403); }
}
