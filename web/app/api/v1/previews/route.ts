import { buildPreviewSystemPrompt, buildPreviewUserPrompt, selectPreviewProvider } from '@/ai';
import type { ExplanationLevel, ReviewContext, ReviewRequestPayload, StreamEvent } from '@/ai/protocol';
import { providerErrorSummary } from '@/ai/provider';
import { AiPausedError, PREVIEW_ACCOUNT_DAY_LIMIT, PreviewLimitError, spendAccount } from '@/ai/spendMeter';
import { aiRequestRequiresSession } from '@/lib/aiAccess';
import { unauthorized, userFromRequest } from '@/lib/auth';
import { payloadSizeError } from '@/lib/reviewLimits';
import { trialInstallFromRequest, trialInstallMeta, trialPreviewDenied } from '@/lib/trialAccess';
import { looksSecret } from '@/lib/tryDemo';

export const runtime = 'nodejs';

/** Same words as the explanation route: provider details stay in the server log. */
const PROVIDER_FAILURE = 'The AI service had a problem. Try again in a minute.';
const LEVELS: readonly ExplanationLevel[] = ['new', 'beginner', 'intermediate', 'advanced', 'expert'];

/**
 * Quick look (the D5 preview): 3 short bullets on a selection, streamed like an explanation.
 *
 * Request: POST `{ level, context }` with the explanation's auth (a signed-in session or a trial
 * install). Only the selection's context is read: scope is always 'selection', and every other field
 * (question, variant, detail, model, any token count) is dropped, so a client can't change the prompt
 * or raise the 400-token output budget (`selectPreviewProvider`).
 *
 * Refusals before anything is reserved or sent: 400 (missing fields, or a key or password in the
 * code), 413 (the explanation's size cap), 401, 429 `plan_limit_reached` (a trial whose 30 days
 * ended), 503. A preview's own allowance (≤ $2 a UTC day for everyone, ≤ 20 a UTC day per account)
 * answers 429 `preview_limit_reached`. Past the shared caps ($10 day, $35 month, $1 per account day)
 * the stream says so, exactly as for an explanation.
 *
 * A preview never takes an explanation from the plan or the trial, and records no usage row: its
 * spend is counted by the meter alone.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { level?: unknown; context?: Partial<ReviewContext> } | null;
  const level = LEVELS.find((candidate) => candidate === body?.level);
  const ctx = body?.context;
  if (!level || !ctx || typeof ctx !== 'object' || typeof ctx.code !== 'string' || !ctx.code.trim()) {
    return Response.json({ error: 'missing level or code' }, { status: 400 });
  }
  const context: ReviewContext = {
    language: typeof ctx.language === 'string' ? ctx.language : 'unknown',
    projectStructure: Array.isArray(ctx.projectStructure) ? ctx.projectStructure.filter((item) => typeof item === 'string') : [],
    imports: Array.isArray(ctx.imports) ? ctx.imports.filter((item) => typeof item === 'string') : [],
    code: ctx.code,
    ...(typeof ctx.primaryFile === 'string' ? { primaryFile: ctx.primaryFile } : {}),
    ...(typeof ctx.enclosing === 'string' ? { enclosing: ctx.enclosing } : {}),
    ...(ctx.truncated === true ? { truncated: true } : {}),
    ...(ctx.selection && Number.isSafeInteger(ctx.selection.startLine) && Number.isSafeInteger(ctx.selection.endLine)
      ? { selection: { file: String(ctx.selection.file ?? ''), startLine: ctx.selection.startLine, endLine: ctx.selection.endLine } }
      : {}),
  };
  const payload: ReviewRequestPayload = { scope: 'selection', level, context };
  const tooLarge = payloadSizeError(payload);
  if (tooLarge) return tooLarge;
  // The app scans for secrets before it sends; this is the server's own check on every text that
  // reaches the prompt, with the detector the Try box and the PMF survey use.
  const texts = [context.code, context.enclosing, context.primaryFile, context.imports.join('\n'), context.projectStructure.join('\n')];
  if (texts.some((text) => text && looksSecret(text))) {
    return Response.json({
      error: 'secret_detected',
      message: 'That looks like it has a key or password in it. Take it out and try again.',
    }, { status: 400 });
  }

  const trialInstall = trialInstallFromRequest(req);
  const userId = trialInstall ? null : await userFromRequest(req);
  const account = userId ? spendAccount('user', userId) : trialInstall ? spendAccount('install', trialInstall) : undefined;
  const provider = selectPreviewProvider(account);
  if (!provider) return Response.json({ error: 'The AI service is unavailable. Try again later.' }, { status: 503 });
  if (aiRequestRequiresSession(provider.mock) && !userId && !trialInstall) return unauthorized();
  if (!provider.mock && trialInstall) {
    const denied = await trialPreviewDenied(trialInstall, new Date(), trialInstallMeta(req));
    if (denied) return denied;
  }

  const system = buildPreviewSystemPrompt(payload);
  const user = buildPreviewUserPrompt(payload);
  const encoder = new TextEncoder();

  // The preview's own allowance is checked inside the meter before anything is reserved or sent. The
  // response waits for that answer (the first token, the end, or a failure), so a spent allowance is a
  // plain 429 rather than a stream.
  const outcome: { limit?: PreviewLimitError } = {};
  let settled!: () => void;
  const decided = new Promise<void>((resolve) => { settled = resolve; });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent): void => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Nobody is reading any more.
        }
      };
      try {
        await provider.stream(system, user, (text) => {
          settled();
          send({ type: 'token', text });
        }, req.signal);
        send({ type: 'done', model: provider.name, mock: provider.mock });
      } catch (err) {
        if (err instanceof PreviewLimitError) {
          outcome.limit = err;
        } else if (err instanceof AiPausedError) {
          // The spend meter refused before anything was sent; no other provider is tried.
          send({ type: 'error', message: err.message });
        } else {
          if (!req.signal.aborted) console.error('preview provider failed', providerErrorSummary(err));
          send({ type: 'error', message: PROVIDER_FAILURE });
        }
      }
      settled();
      try {
        controller.close();
      } catch {
        // Already closed by a cancelled reader.
      }
    },
  });

  await decided;
  if (outcome.limit) {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    return Response.json({
      error: 'preview_limit_reached',
      reason: outcome.limit.reason === 'kind_day_cap' ? 'daily_budget' : 'account_daily_limit',
      message: outcome.limit.message,
      ...(outcome.limit.reason === 'kind_account_calls' ? { limit: PREVIEW_ACCOUNT_DAY_LIMIT } : {}),
      resetsAt: tomorrow.toISOString(),
    }, { status: 429 });
  }
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
}
