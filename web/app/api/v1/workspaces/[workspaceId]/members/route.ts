import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { workspaceId: string } }): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try { return Response.json({ members: await getBillingStore().listMembers(user, params.workspaceId) }); }
  catch (error) { return billingError(error, 403); }
}
