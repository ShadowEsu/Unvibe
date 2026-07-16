import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  const params = new URL(req.url).searchParams;
  const requestedLimit = Number(params.get('limit') ?? '100');
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500) : 100;
  const cursor = params.get('cursor') ?? undefined;
  try {
    return Response.json(await getStore().historyPage(userId, limit, cursor));
  } catch (error) {
    if (error instanceof Error && /cursor/i.test(error.message)) {
      return Response.json({ error: 'invalid cursor' }, { status: 400 });
    }
    throw error;
  }
}
