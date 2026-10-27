import { selectProvider, buildComprehensionPrompt } from '@/ai';
import { parseQuestion } from '@/ai/comprehension';
import type { ReviewRequestPayload } from '@/ai/protocol';
import { aiRequestRequiresSession } from '@/lib/aiAccess';
import { accountDeleted, sessionUser, unauthorized } from '@/lib/auth';
import { billedUsage, type TokenUsage } from '@/ai/provider';
import { recordMeteredTokens, releaseMeteredAction, reserveMeteredAction } from '@/billing/enforce';
import { recordTrialTokens, reserveTrialAction, trialInstallFromRequest, trialInstallMeta } from '@/lib/trialAccess';
import { payloadCharacters, payloadSizeError } from '@/lib/reviewLimits';
import { clientIp } from '@/lib/tryDemo';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const trialInstall = trialInstallFromRequest(req);
  const session = trialInstall ? null : await sessionUser(req);
  if (session?.deleting) return accountDeleted();
  const userId = session?.userId ?? null;
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
  let recordTokens: ((usage: TokenUsage) => Promise<void>) | null = null;
  if (!provider.mock && userId) {
    const reserved = await reserveMeteredAction(userId, 'project_question', req, { characters: payloadCharacters(payload) });
    if (reserved instanceof Response) return reserved;
    release = () => releaseMeteredAction(userId, 'project_question', reserved);
    recordTokens = (usage) => recordMeteredTokens(userId, 'project_question', usage);
  } else if (!provider.mock && trialInstall) {
    const trial = await reserveTrialAction(trialInstall, 'project_question', clientIp(req), new Date(), trialInstallMeta(req));
    if (trial.denied) return trial.denied;
    release = trial.release;
    recordTokens = (usage) => recordTrialTokens('project_question', usage);
  }
  const { system, user } = buildComprehensionPrompt(payload);
  // A failure after Gemini accepted the request still carries its (estimated) usage.
  let usage: TokenUsage | undefined;
  const completion = await provider.complete(system, user, req.signal).catch((error: unknown) => {
    usage = billedUsage(error);
    return null;
  });
  usage = completion?.usage ?? usage;
  // The call was billed whether or not the question parses, so its counts are kept either way.
  if (usage) await recordTokens?.(usage);
  const question = completion === null ? undefined : parseQuestion(completion.text);
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
