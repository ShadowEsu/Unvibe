import { selectProvider, buildComprehensionPrompt } from '@/ai';
import { parseQuestion } from '@/ai/comprehension';
import type { ReviewRequestPayload } from '@/ai/protocol';
import { aiRequestRequiresSession } from '@/lib/aiAccess';
import { unauthorized, userFromRequest } from '@/lib/auth';
import { releaseMeteredAction, reserveMeteredAction } from '@/billing/enforce';
import { reserveTrialAction, trialInstallFromRequest } from '@/lib/trialAccess';
import { payloadSizeError } from '@/lib/reviewLimits';
import { clientIp } from '@/lib/tryDemo';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const trialInstall = trialInstallFromRequest(req);
  const userId = trialInstall ? null : await userFromRequest(req);
  const payload = (await req.json().catch(() => null)) as ReviewRequestPayload | null;
  const provider = selectProvider(payload?.model);
  if (aiRequestRequiresSession(provider.mock) && !userId && !trialInstall) {
    return unauthorized();
  }
  if (!payload?.context) {
    return Response.json({ error: 'missing context' }, { status: 400 });
  }
  const tooLarge = payloadSizeError(payload);
  if (tooLarge) return tooLarge;
  let release: (() => Promise<void>) | null = null;
  if (!provider.mock && userId) {
    const denied = await reserveMeteredAction(userId, 'project_question', req);
    if (denied) return denied;
    release = () => releaseMeteredAction(userId, 'project_question', req);
  } else if (!provider.mock && trialInstall) {
    const trial = await reserveTrialAction(trialInstall, 'project_question', clientIp(req));
    if (trial.denied) return trial.denied;
    release = trial.release;
  }
  const { system, user } = buildComprehensionPrompt(payload);
  const text = await provider.complete(system, user, req.signal).catch(() => null);
  const question = text === null ? undefined : parseQuestion(text);
  if (!question) {
    // Spent only on a question the person can answer; a client that disconnected keeps the charge.
    if (!req.signal.aborted) await release?.();
    return Response.json(
      { error: 'question_unavailable', message: 'Could not write a question about this code just now. Try again in a moment.' },
      { status: 502 },
    );
  }
  return Response.json(question);
}
