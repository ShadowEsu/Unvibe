import { getStore } from '@/data/store';
import { userFromRequest, unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';

/** Who am I — used by the app to show the signed-in identity. */
export async function GET(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  return Response.json(await getStore().accountInfo(userId));
}

/** App Store requirement: an authenticated user can delete their account and all their data. */
export async function DELETE(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  await getStore().deleteAccount(userId);
  return Response.json({ ok: true });
}
