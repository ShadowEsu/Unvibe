import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  return Response.json(await getStore().usage(userId));
}
