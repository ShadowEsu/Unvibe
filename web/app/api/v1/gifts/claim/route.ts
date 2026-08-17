import { claimGift } from '@/gifts/service';

export const runtime = 'nodejs';

const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
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
    return Response.json({ error: 'rate_limited', message: 'Please try again shortly.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    recipientEmail?: unknown;
    giverEmail?: unknown;
    promoCode?: unknown;
  };
  const result = await claimGift({
    recipientEmail: typeof body.recipientEmail === 'string' ? body.recipientEmail : '',
    giverEmail: typeof body.giverEmail === 'string' ? body.giverEmail : '',
    promoCode: typeof body.promoCode === 'string' ? body.promoCode : '',
  });
  if (!result.ok) {
    const status = result.error === 'unknown_code' || result.error === 'self_gift' || result.error === 'invalid_email' ? 400 : 409;
    return Response.json(result, { status });
  }
  return Response.json(result);
}
