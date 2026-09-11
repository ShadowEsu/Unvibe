import { getBillingStore } from '@/billing/store';
import { getStore } from '@/data/store';
import { billingError, isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { workspaceId: string } }): Promise<Response> {
  const user = await requireUser(_req);
  if (isResponse(user)) return user;
  try {
    const access = await getBillingStore().getWorkspaceAccess(user, params.workspaceId);
    if (!access) {
      return Response.json({ error: 'forbidden', message: 'Not a member of that workspace.' }, { status: 403 });
    }
    const projects = await getStore().workspaceProjects(params.workspaceId);
    return Response.json({ projects });
  } catch (error) {
    return billingError(error);
  }
}
