import { getBillingStore } from '@/billing/store';
import { getStore } from '@/data/store';
import { billingError, isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { workspaceId: string } }): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const access = await getBillingStore().getWorkspaceAccess(user, params.workspaceId);
    if (!access) {
      return Response.json({ error: 'forbidden', message: 'Not a member of that workspace.' }, { status: 403 });
    }
    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? '50');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
    const cursor = url.searchParams.get('cursor') ?? undefined;
    const page = await getStore().workspaceHistoryPage(params.workspaceId, limit, cursor);
    return Response.json(page);
  } catch (error) {
    return billingError(error);
  }
}
