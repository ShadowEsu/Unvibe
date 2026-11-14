import { buildPreviewSystemPrompt, buildPreviewUserPrompt, selectPreviewProvider } from '@/ai';
import type { ExplanationLevel, ReviewContext, ReviewRequestPayload, StreamEvent } from '@/ai/protocol';
import { providerErrorSummary } from '@/ai/provider';
import { AbortedBeforeSendError, AiPausedError, PREVIEW_ACCOUNT_DAY_LIMIT, PreviewLimitError, spendAccount } from '@/ai/spendMeter';
import { aiRequestRequiresSession } from '@/lib/aiAccess';
import { unauthorized, userFromRequest } from '@/lib/auth';
import { payloadSizeError, previewSizeError } from '@/lib/reviewLimits';
import { reserveTrialPreview, trialInstallFromRequest, trialInstallMeta } from '@/lib/trialAccess';
import { clientIp } from '@/lib/tryDemo';

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
 * Refusals before anything is reserved or sent: 400 (missing fields), 413 (the explanation's size
 * cap, then the preview's own 20,000 characters, `previewSizeError`), 401, 429 `plan_limit_reached` (a trial whose 30 days
 * ended), 429 `preview_limit_reached` with
 * reason `network_daily_limit` (a network's trial previews for the day), 503. A preview's own
 * allowance answers 429 `preview_limit_reached` too: reason `daily_budget` (≤ $2 a UTC day for
 * everyone, which also counts previews still in flight, so it means "later", not "tomorrow") or
 * `account_daily_limit` (≤ 20 a UTC day per account). Past the shared caps ($10 day, $35 month, $1
 * per account day) the stream says so, exactly as for an explanation.
 *
 * Secrets: like an explanation, the app's secret scan runs before it sends; the server adds no
 * filter of its own to either route.
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
  const tooLarge = payloadSizeError(payload) ?? previewSizeError(context);
  if (tooLarge) return tooLarge;

  const trialInstall = trialInstallFromRequest(req);
  const userId = trialInstall ? null : await userFromRequest(req);
  const account = userId ? spendAccount('user', userId) : trialInstall ? spendAccount('install', trialInstall) : undefined;
  const provider = selectPreviewProvider(account);
  if (!provider) return Response.json({ error: 'The AI service is unavailable. Try again later.' }, { status: 503 });
  if (aiRequestRequiresSession(provider.mock) && !userId && !trialInstall) return unauthorized();
  // A trial's network unit, given back when the meter refuses the preview or the caller leaves before
  // anything is sent (as explanations give back their trial units); kept once the provider was called.
  let releaseNetwork: (() => Promise<void>) | undefined;
  if (!provider.mock && trialInstall) {
    const trial = await reserveTrialPreview(trialInstall, clientIp(req), new Date(), trialInstallMeta(req));
    if (trial.denied) return trial.denied;
    releaseNetwork = trial.release;
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
        if (err instanceof PreviewLimitError || err instanceof AiPausedError || err instanceof AbortedBeforeSendError) {
          // The meter refused, or the caller left, before anything was sent.
          await releaseNetwork?.();
        }
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
    const account = outcome.limit.reason === 'kind_account_calls';
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    return Response.json({
      error: 'preview_limit_reached',
      reason: account ? 'account_daily_limit' : 'daily_budget',
      message: outcome.limit.message,
      ...(account ? { limit: PREVIEW_ACCOUNT_DAY_LIMIT, resetsAt: tomorrow.toISOString() } : {}),
    }, { status: 429 });
  }
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
}
