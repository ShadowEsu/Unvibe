import { selectProvider, buildComprehensionPrompt } from '@/ai';
import { parseQuestion } from '@/ai/comprehension';
import type { ReviewRequestPayload } from '@/ai/protocol';
import { aiRequestRequiresSession } from '@/lib/aiAccess';
import { unauthorized, userFromRequest } from '@/lib/auth';
import { releaseMeteredAction, reserveMeteredAction } from '@/billing/enforce';
import { releaseTrialAction, reserveTrialAction, trialInstallFromRequest } from '@/lib/trialAccess';

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
  if (JSON.stringify(payload.context).length > 120_000) {
    return Response.json({ error: 'review context exceeds the 120,000 character limit' }, { status: 413 });
  }
  let release: (() => Promise<void>) | null = null;
  if (!provider.mock && userId) {
    const denied = await reserveMeteredAction(userId, 'project_question', req);
    if (denied) return denied;
    release = () => releaseMeteredAction(userId, 'project_question', req);
  } else if (!provider.mock && trialInstall) {
    const denied = await reserveTrialAction(trialInstall, 'project_question');
    if (denied) return denied;
    release = () => releaseTrialAction(trialInstall, 'project_question');
  }
  const { system, user } = buildComprehensionPrompt(payload);
  const text = await provider.complete(system, user, req.signal).catch(() => null);
  const question = text === null ? undefined : parseQuestion(text);
  if (!question) {
    // The allowance is only spent on a question the person can answer.
    await release?.();
    return Response.json(
      { error: 'question_unavailable', message: 'Could not write a question about this code just now. Try again in a moment.' },
      { status: 502 },
    );
  }
  return Response.json(question);
}
