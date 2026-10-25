import { isProgressKind, recordProgress } from '@/lib/activation';
import { unauthorized } from '@/lib/auth';
import { reserveTrialProgressPing, trialInstallFromRequest } from '@/lib/trialAccess';
import { clientIp } from '@/lib/tryDemo';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 256;

/**
 * Write-once setup progress for an anonymous trial install (instrumentation spec 6.2): body
 * `{ "step": <ProgressKind> }`, trial token + install ID headers, never a session token. Only the
 * step and the server's time are stored; every other body field is ignored.
 * 204: stored, already stored, or a logged storage error. 409: no install row yet (the app retries
 * next launch). 400: missing or unknown step (the app never retries it).
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
  let step: unknown = null;
  try {
    step = (JSON.parse(raw) as { step?: unknown } | null)?.step;
  } catch {
    step = null;
  }
  if (!isProgressKind(step)) return Response.json({ error: 'bad_step' }, { status: 400 });
  const result = await recordProgress(installKey, step);
  if (result === 'no_install') return Response.json({ error: 'no_install' }, { status: 409 });
  return new Response(null, { status: 204 });
}
