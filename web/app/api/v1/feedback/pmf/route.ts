import { unauthorized } from '@/lib/auth';
import { PMF_MAX_BODY_BYTES, parsePmfAnswer, pmfInstallKey, recordPmfAnswer, reservePmfRequest } from '@/lib/pmfSurvey';
import { trialInstallIdFromRequest } from '@/lib/trialAccess';
import { clientIp } from '@/lib/tryDemo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };
const reply = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

/**
 * The in-app PMF survey (FE-09; see src/lib/pmfSurvey.ts). Desktop app only: trial token + install
 * ID headers, as the app's other anonymous calls, and no CORS headers, so a web page can't read or
 * preflight it; a request carrying a web Origin is refused outright (403).
 * Body (JSON, at most 16 KB, no other keys): `{ q1, q2, q3, q4, appVersion, consent: 'pmf-v1' }`.
 * 201 `{ ok: true }`: stored. 400: invalid body or field, or a text that looks like a key or
 * password (only the field name comes back). 409: this install answered in the last 90 days; the
 * first answer is kept. 401 / 413 / 415 / 429 / 503 otherwise. Never a 500; answers are never logged.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    if (/^https?:\/\//i.test(req.headers.get('origin') ?? '')) return reply({ error: 'forbidden' }, 403);
    const installId = trialInstallIdFromRequest(req);
    if (!installId) return unauthorized();
    if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) return reply({ error: 'unsupported_media_type' }, 415);
    if (Number(req.headers.get('content-length') ?? 0) > PMF_MAX_BODY_BYTES) return reply({ error: 'too_large' }, 413);
    const limited = await reservePmfRequest(clientIp(req));
    if (limited === 'limited') return reply({ error: 'rate_limited', message: 'Please try again later.' }, 429);
    if (limited === 'unavailable') return reply({ error: 'feedback_unavailable' }, 503);
    const raw = await req.text().catch(() => '');
    if (Buffer.byteLength(raw) > PMF_MAX_BODY_BYTES) return reply({ error: 'too_large' }, 413);
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
    const parsed = parsePmfAnswer(body);
    if ('invalid' in parsed) return reply({ error: 'invalid_field', field: parsed.invalid }, 400);
    if ('secret' in parsed) return reply({ error: 'secret_detected', field: parsed.secret }, 400);
    const installKey = pmfInstallKey(installId);
    if (!installKey) return reply({ error: 'feedback_unavailable' }, 503);
    const result = await recordPmfAnswer(installKey, parsed.answer);
    if (result === 'duplicate') return reply({ error: 'already_answered' }, 409);
    if (result === 'unavailable') return reply({ error: 'feedback_unavailable' }, 503);
    return reply({ ok: true }, 201);
  } catch (error) {
    // Never the answer text: only what kind of failure it was.
    console.error('pmf feedback failed', error instanceof Error ? error.name : 'unknown');
    return reply({ error: 'feedback_unavailable' }, 503);
  }
}
