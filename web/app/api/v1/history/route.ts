import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  const limit = Number(new URL(req.url).searchParams.get('limit') ?? '100');
  return Response.json(await getStore().history(userId, Math.min(Math.max(limit, 1), 500)));
}
