import { unauthorized } from '@/lib/auth';
import { parsePmfAnswer, pmfInstallKey, recordPmfAnswer } from '@/lib/pmfSurvey';
import { reservePmfSubmission, trialInstallIdFromRequest } from '@/lib/trialAccess';
import { clientIp } from '@/lib/tryDemo';

export const runtime = 'nodejs';

/** Three 1000-character answers, even fully JSON-escaped, plus the other fields. */
const MAX_BODY_BYTES = 24_576;

/**
 * The in-app PMF survey (FE-09; see src/lib/pmfSurvey.ts). Trial token + install ID headers, as the
 * app's other anonymous routes, and the same per-network daily rate limit as trial progress pings.
 * Body: `{ q1, q2, q3, q4, explanations, daysSinceInstall, appVersion, consent: 'pmf-v1' }`.
 * 201 `{ ok: true }`: stored. 400: wrong consent or any invalid field (the field name is returned).
 * 409: this install already answered in the last 90 days; the first answer is kept.
 * 401 / 413 / 429 / 503 as the trial routes. Answer text is never logged.
 */
export async function POST(req: Request): Promise<Response> {
  const installId = trialInstallIdFromRequest(req);
  if (!installId) return unauthorized();
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: 'too_large' }, { status: 413 });
  }
  const limited = await reservePmfSubmission(clientIp(req));
  if (limited === 'limited') return Response.json({ error: 'rate_limited', message: 'Please try again tomorrow.' }, { status: 429 });
  if (limited === 'unavailable') return Response.json({ error: 'feedback_unavailable' }, { status: 503 });
  const raw = await req.text().catch(() => '');
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return Response.json({ error: 'too_large' }, { status: 413 });
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const parsed = parsePmfAnswer(body);
  if ('invalid' in parsed) return Response.json({ error: 'invalid_field', field: parsed.invalid }, { status: 400 });
  const result = await recordPmfAnswer(pmfInstallKey(installId), parsed.answer);
  if (result === 'duplicate') return Response.json({ error: 'already_answered' }, { status: 409 });
  if (result === 'unavailable') return Response.json({ error: 'feedback_unavailable' }, { status: 503 });
  return Response.json({ ok: true }, { status: 201 });
}
