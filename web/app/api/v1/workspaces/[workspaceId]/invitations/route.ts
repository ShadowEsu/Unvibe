import { createHash, randomBytes } from 'node:crypto';
import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { publicAppUrl } from '@/billing/stripe';

export const runtime = 'nodejs';

function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

export async function GET(req: Request, { params }: { params: { workspaceId: string } }): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try { return Response.json({ invitations: await getBillingStore().listInvitations(user, params.workspaceId) }); }
  catch (error) { return billingError(error, 403); }
}

export async function POST(req: Request, { params }: { params: { workspaceId: string } }): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const body = (await req.json()) as { email?: unknown; role?: unknown };
    if (typeof body.email !== 'string' || !/^\S+@\S+\.\S+$/.test(body.email) || (body.role !== 'admin' && body.role !== 'member')) {
      return Response.json({ error: 'invalid_invitation', message: 'Enter an email and choose Admin or Member.' }, { status: 400 });
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const billing = getBillingStore();
    const invitation = await billing.createInvitation(user, params.workspaceId, body.email, body.role, hashToken(token), expiresAt);
    await billing.recordAudit(user, params.workspaceId, 'invitation.created', { invitationId: invitation.id, role: invitation.role });
    return Response.json({ invitation, inviteUrl: `${publicAppUrl(req)}/invite/${token}` }, { status: 201 });
  } catch (error) { return billingError(error, 409); }
}
