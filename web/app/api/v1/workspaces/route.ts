import { getBillingStore } from '@/billing/store';
import { billingError, isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try { return Response.json({ workspaces: await getBillingStore().listWorkspaces(user) }); }
  catch (error) { return billingError(error); }
}

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const body = (await req.json()) as { name?: unknown };
    if (typeof body.name !== 'string' || !body.name.trim()) return Response.json({ error: 'invalid_name' }, { status: 400 });
    return Response.json({ workspace: await getBillingStore().createTeamWorkspace(user, body.name) }, { status: 201 });
  } catch (error) { return billingError(error); }
}
