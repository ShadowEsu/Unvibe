import { GiftError, giftProgressForUser } from '@/billing/gifts';
import { isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The signed-in giver's gift code, share link and how many friends used it. */
export async function GET(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const progress = await giftProgressForUser(user);
    return Response.json(progress, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof GiftError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status, headers: { 'cache-control': 'no-store' } });
    }
    console.error('gift progress failed', error);
    return Response.json({ error: 'gift_error', message: 'Gift details could not load.' }, { status: 503 });
  }
}
