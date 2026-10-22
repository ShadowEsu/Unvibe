import { claimGift, GiftError } from '@/billing/gifts';
import { isResponse, requireUser } from '@/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const prior = hits.get(key);
  if (!prior || prior.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  prior.count += 1;
  return prior.count > RATE_LIMIT.max;
}

/**
 * The signed-in caller redeems a friend's gift code. The caller is always the receiver;
 * emails in the body are ignored. The code identifies the giver.
 */
export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'local';
  if (rateLimited(`ip:${ip}`)) {
    return Response.json({ error: 'rate_limited', message: 'Please try again shortly.' }, { status: 429 });
  }
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  if (rateLimited(`user:${user}`)) {
    return Response.json({ error: 'rate_limited', message: 'Please try again shortly.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  try {
    const result = await claimGift(user, body.code);
    return Response.json({ ok: true, ...result }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof GiftError) {
      return Response.json({ ok: false, error: error.code, message: error.message }, { status: error.status, headers: { 'cache-control': 'no-store' } });
    }
    console.error('gift claim failed', error);
    return Response.json({ ok: false, error: 'gift_error', message: 'The gift could not be claimed. Try again shortly.' }, { status: 503 });
  }
}
