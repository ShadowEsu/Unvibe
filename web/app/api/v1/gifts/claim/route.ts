import { claimGift } from '@/billing/gifts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'local';
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const prior = hits.get(ip);
  if (!prior || prior.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  prior.count += 1;
  return prior.count > RATE_LIMIT.max;
}

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(clientIp(req))) {
    return Response.json({ error: 'Please try again shortly.' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const result = await claimGift(body);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gift could not be claimed.';
    const code = /both required/i.test(message) ? 'invalid_email'
      : /does not match/i.test(message) ? 'unknown_code'
      : 'gift_error';
    return Response.json({ ok: false, error: code, message }, { status: 400 });
  }
}
