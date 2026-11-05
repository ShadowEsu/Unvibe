import { isProgressKind, recordProgress } from '@/lib/activation';
import { unauthorized } from '@/lib/auth';
import { recordHeardFrom, reserveTrialProgressPing, trialInstallFromRequest } from '@/lib/trialAccess';
import { clientIp } from '@/lib/tryDemo';

export const runtime = 'nodejs';

/** Room for a 200-character first-run answer in any script (up to 4 bytes each) plus the step. */
const MAX_BODY_BYTES = 1024;

/**
 * Write-once setup progress for an anonymous trial install (instrumentation spec 6.2): body
 * `{ "step": <ProgressKind> }`, trial token + install ID headers, never a session token. Only the
 * step and the server's time are stored; every other body field is ignored.
 * One more step, `{ "step": "heard_from", "answer": "..." }`, is the optional first-run answer to
 * "Where did you hear about Unvibe?": stored, cleaned and capped, on the install row, never as a
 * marker, and the first non-empty answer wins (`recordHeardFrom`). An empty answer stores nothing.
 * 204: stored or already stored. 409: no install row yet. 503: a logged storage error, including
 * the step's kind (or the heard_from column) not being there yet before its migration. The app
 * retries 409 and 503 next launch. 400: missing or unknown step (the app never retries it).
 */
export async function POST(req: Request): Promise<Response> {
  const installKey = trialInstallFromRequest(req);
  if (!installKey) return unauthorized();
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: 'too_large' }, { status: 413 });
  }
  const limited = await reserveTrialProgressPing(clientIp(req));
  if (limited === 'limited') return Response.json({ error: 'rate_limited', message: 'Please try again tomorrow.' }, { status: 429 });
  if (limited === 'unavailable') return Response.json({ error: 'trial_unavailable' }, { status: 503 });
  const raw = await req.text().catch(() => '');
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return Response.json({ error: 'too_large' }, { status: 413 });
  let body: { step?: unknown; answer?: unknown } | null = null;
  try {
    body = JSON.parse(raw) as { step?: unknown; answer?: unknown } | null;
  } catch {
    body = null;
  }
  const step = body?.step;
  let result: 'done' | 'no_install' | 'unavailable';
  if (step === 'heard_from') result = await recordHeardFrom(installKey, body?.answer);
  else if (isProgressKind(step)) result = await recordProgress(installKey, step);
  else return Response.json({ error: 'bad_step' }, { status: 400 });
  if (result === 'no_install') return Response.json({ error: 'no_install' }, { status: 409 });
  if (result === 'unavailable') return Response.json({ error: 'trial_unavailable' }, { status: 503 });
  return new Response(null, { status: 204 });
}
