import { createHash } from 'node:crypto';
import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';
import { getStore } from '@/data/store';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const body = (await req.json()) as { token?: unknown };
    if (typeof body.token !== 'string' || body.token.length < 20) return Response.json({ error: 'invalid_invitation' }, { status: 400 });
    const hash = createHash('sha256').update(body.token).digest('hex');
    const account = await getStore().accountInfo(user);
    const workspace = await getBillingStore().acceptInvitation(user, hash, account.email);
    await getBillingStore().recordAudit(user, workspace.id, 'invitation.accepted');
    return Response.json({ workspace });
  } catch (error) { return billingError(error, 409); }
}
