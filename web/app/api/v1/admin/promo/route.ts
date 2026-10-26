import { BATCH_ID_RE, promoBackend, PromoUnavailableError } from '@/billing/promo';
import { isAdminStatsRequest } from '@/lib/adminStats';
import { normalisePromoCode, promoCodeHash } from '@/lib/promoCode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

function answer(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function unavailable(error: unknown): Response {
  if (!(error instanceof PromoUnavailableError)) console.error('admin promo failed', error instanceof Error ? error.message : error);
  return answer({ error: 'promo_unavailable' }, 503);
}

/**
 * Admin-only promo list and revoke, behind UNVIBE_ADMIN_STATS_TOKEN as a bearer token. There
 * is no create: batches and code hashes only come from the one-off SQL insert, so a leaked token
 * cannot mint Pro.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAdminStatsRequest(req)) return answer({ error: 'unauthorized' }, 401);
  try {
    return answer({ ...(await promoBackend().list()), generatedAt: new Date().toISOString() });
  } catch (error) {
    return unavailable(error);
  }
}

/** { action: "revoke_code", code } or { action: "revoke_batch", batchId }. */
export async function POST(req: Request): Promise<Response> {
  if (!isAdminStatsRequest(req)) return answer({ error: 'unauthorized' }, 401);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; code?: unknown; batchId?: unknown };
  try {
    if (body.action === 'revoke_code') {
      const code = normalisePromoCode(body.code);
      if (!code) return answer({ error: 'bad_code' }, 400);
      const result = await promoBackend().revokeCode(promoCodeHash(code));
      return answer({ ok: result.status !== 'not_found', ...result }, result.status === 'not_found' ? 404 : 200);
    }
    if (body.action === 'revoke_batch') {
      if (typeof body.batchId !== 'string' || !BATCH_ID_RE.test(body.batchId)) return answer({ error: 'bad_batch' }, 400);
      const status = await promoBackend().revokeBatch(body.batchId);
      return answer({ ok: status !== 'not_found', status }, status === 'not_found' ? 404 : 200);
    }
    return answer({ error: 'unknown_action' }, 400);
  } catch (error) {
    return unavailable(error);
  }
}
