import { PROMO_RESPONSES, promoBackend, PromoUnavailableError } from '@/billing/promo';
import { normalisePromoCode, promoCodeHash } from '@/lib/promoCode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };
const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, { count: number; resetAt: number }>();

/** Per-instance backstop like gifts/claim. The site's /api/redeem adds the shared Supabase limiter. */
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

function failure(error: string, status: number, message: string): Response {
  return Response.json({ ok: false, error, message }, { status, headers: NO_STORE });
}

/**
 * A signed-in person redeems a promo code: { accessToken, code }. The access token is a Supabase
 * session from the site's sign-in, checked with Supabase Auth exactly as device approval checks
 * it. The account is always the token's owner. Unknown and revoked codes answer the same 404.
 */
export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'local';
  if (rateLimited(`ip:${ip}`)) return failure('rate_limited', 429, 'Too many tries. Wait a minute and try again.');

  const body = (await req.json().catch(() => ({}))) as { accessToken?: unknown; code?: unknown };
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
  if (!accessToken) return failure('unauthorized', 401, 'Sign in to redeem a code.');
  const code = normalisePromoCode(body.code);
  if (!code) return failure('bad_code', 400, PROMO_RESPONSES.bad_code.message);

  try {
    const backend = promoBackend();
    const account = await backend.verifyAccessToken(accessToken);
    if (!account) return failure('unauthorized', 401, 'Your sign-in has expired. Sign in again.');
    if (rateLimited(`user:${account.id}`)) return failure('rate_limited', 429, 'Too many tries. Wait a minute and try again.');
    await backend.upsertUser(account);
    const result = await backend.redeem(account.id, promoCodeHash(code));
    const { http, message } = PROMO_RESPONSES[result.status];
    if (http !== 200) return failure(result.status, http, message);
    return Response.json({ ok: true, status: result.status, months: result.months, proUntil: result.proUntil, message }, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof PromoUnavailableError)) console.error('promo redeem failed', error instanceof Error ? error.message : error);
    return failure('unavailable', 503, 'Codes cannot be redeemed right now. Try again shortly.');
  }
}
