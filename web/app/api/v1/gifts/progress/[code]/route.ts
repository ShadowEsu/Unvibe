import { giftProgress } from '@/gifts/service';

export const runtime = 'nodejs';

const RATE_LIMIT = { windowMs: 60_000, max: 40 };
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

export async function GET(req: Request, { params }: { params: { code: string } }): Promise<Response> {
  if (rateLimited(clientIp(req))) {
    return Response.json({ error: 'rate_limited', message: 'Please try again shortly.' }, { status: 429 });
  }
  const progress = await giftProgress(params.code);
  if (!progress.found) return Response.json({ error: 'unknown_code', message: 'That SPECIAL CHAR was not recognised.' }, { status: 404 });
  return Response.json(progress);
}
