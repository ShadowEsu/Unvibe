import { selectProvider, buildSystemPrompt, buildUserPrompt } from '@/ai';
import type { ReviewRequestPayload, StreamEvent } from '@/ai/protocol';
import { unauthorized, userFromRequest } from '@/lib/auth';
import { aiRequestRequiresSession } from '@/lib/aiAccess';
import { billedUsage, providerErrorSummary, type TokenUsage } from '@/ai/provider';
import { AiPausedError } from '@/ai/spendMeter';
import { proRequired, recordMeteredTokens, releaseMeteredAction, reserveMeteredAction } from '@/billing/enforce';
import { recordTrialTokens, reserveTrialAction, trialInstallFromRequest, trialInstallMeta } from '@/lib/trialAccess';
import { payloadSizeError } from '@/lib/reviewLimits';
import { clientIp } from '@/lib/tryDemo';
import { recordActivation } from '@/lib/activation';

export const runtime = 'nodejs';

/** Provider errors carry status codes and response bodies (project ids, key hints); those stay in the server log. */
const PROVIDER_FAILURE = 'The AI service had a problem. Try again in a minute.';

export async function POST(req: Request): Promise<Response> {
  const payload = (await req.json().catch(() => null)) as ReviewRequestPayload | null;
  if (!payload?.scope || !payload?.level || !payload?.context) {
    return Response.json({ error: 'missing scope, level, or context' }, { status: 400 });
  }
  const tooLarge = payloadSizeError(payload);
  if (tooLarge) return tooLarge;

  const trialInstall = trialInstallFromRequest(req);
  const userId = trialInstall ? null : await userFromRequest(req);
  const provider = selectProvider();
  if (!provider) return Response.json({ error: 'The AI service is unavailable. Try again later.' }, { status: 503 });
  if (aiRequestRequiresSession(provider.mock) && !userId && !trialInstall) {
    return unauthorized();
  }

  // Pro features, as in the desktop app: Git diff explanations and Change briefs send scope 'diff'
  // with the hunks, Since last understood sends scope 'file', and 'project' is the architecture
  // overview. Follow-ups and "Explain differently" on them keep that scope. Selection explanations,
  // their follow-ups and "Explain differently" stay on every plan. Refused before anything is
  // reserved. The mock provider (local development) has no allowance and no Pro gate; its
  // placeholder text is not the Pro feature.
  const proOnly = payload.scope === 'diff' || payload.scope === 'file' || payload.scope === 'project'
    || Boolean(payload.context.diffHunks?.length);

  // Signed-in accounts spend their plan's monthly allowance (the same one the Plan page shows).
  // Follow-ups and "Explain differently" are follow-up questions; anything else is an explanation.
  // The sealed trial keeps one explanation budget for both.
  // Token counts (no text) go onto the reserved usage row, or the trial's daily totals.
  let release: (() => Promise<void>) | null = null;
  let recordTokens: ((usage: TokenUsage) => Promise<void>) | null = null;
  let trialStartedAt: string | undefined;
  if (!provider.mock && userId) {
    const kind = payload.question || payload.variant === 'different' ? 'project_question' : 'ai_explanation';
    const reserved = await reserveMeteredAction(userId, kind, req, { proOnly });
    if (reserved instanceof Response) return reserved;
    release = () => releaseMeteredAction(userId, kind, reserved);
    recordTokens = (usage) => recordMeteredTokens(userId, kind, usage);
  } else if (!provider.mock && trialInstall) {
    if (proOnly) return proRequired();
    const trial = await reserveTrialAction(trialInstall, 'ai_explanation', clientIp(req), new Date(), trialInstallMeta(req));
    if (trial.denied) return trial.denied;
    release = trial.release;
    trialStartedAt = trial.startedAt;
    recordTokens = (usage) => recordTrialTokens('ai_explanation', usage);
  }

  const system = buildSystemPrompt(payload);
  const user = buildUserPrompt(payload);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Enqueue fails once the reader has gone away (the app gave up or closed the panel).
      const send = (event: StreamEvent): void => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Nobody is reading any more; the answer still counts.
        }
      };
      let produced = false;
      try {
        const usage = await provider.stream(system, user, (text) => {
          if (text.trim()) produced = true;
          send({ type: 'token', text });
        }, req.signal);
        send({ type: 'done', model: provider.name, mock: provider.mock });
        if (usage) await recordTokens?.(usage);
        if (produced && !provider.mock && trialInstall && payload.scope === 'selection' && !payload.question && payload.variant !== 'different') {
          await recordActivation(trialInstall, payload.context.code, { startedAt: trialStartedAt }).catch((error) => {
            console.error('activation marker write failed', error);
          });
        }
      } catch (err) {
        if (err instanceof AiPausedError) {
          // The spend meter refused before anything was sent; no other provider is tried.
          send({ type: 'error', message: err.message });
        } else {
          if (!req.signal.aborted) console.error('review provider failed', providerErrorSummary(err));
          send({ type: 'error', message: PROVIDER_FAILURE });
        }
        // Anthropic accepted the request before it failed (e.g. the stream was cut off): record the estimate.
        const billed = billedUsage(err);
        if (billed) await recordTokens?.(billed);
      }
      // Refund only when the provider failed or wrote nothing. A client that disconnects keeps the
      // charge: otherwise dropping the connection would make any request free to repeat.
      if (!produced && !req.signal.aborted) await release?.();
      try {
        controller.close();
      } catch {
        // Already closed by a cancelled reader.
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
}
