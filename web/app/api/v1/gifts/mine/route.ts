import { applyGiftsForEmail, giftProgressForEmail } from '@/billing/gifts';
import { getStore } from '@/data/store';
import { isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  const account = await getStore().accountInfo(user);
  if (!account.email) {
    return Response.json({ error: 'email_required', message: 'Sign in with an email to get your gift code.' }, { status: 400 });
  }
  try {
    await applyGiftsForEmail(account.email);
    const progress = await giftProgressForEmail(account.email);
    return Response.json({ email: account.email, ...progress }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gift details could not load.';
    return Response.json({ error: 'gift_error', message }, { status: 503 });
  }
}
