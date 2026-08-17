import { selectProvider, buildSystemPrompt, buildUserPrompt } from '@/ai';
import type { ReviewRequestPayload, StreamEvent } from '@/ai/protocol';
import { userFromRequest } from '@/lib/auth';
import { getStore } from '@/data/store';
import { quotaMessage } from '@/billing/plans';
import { reserveMeteredAction } from '@/billing/enforce';
import { reserveTrialAction, trialInstallFromRequest } from '@/lib/trialAccess';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const payload = (await req.json().catch(() => null)) as ReviewRequestPayload | null;
  if (!payload?.scope || !payload?.level || !payload?.context) {
    return Response.json({ error: 'missing scope, level, or context' }, { status: 400 });
  }

  const provider = selectProvider();
  const trialInstall = trialInstallFromRequest(req);
  const userId = trialInstall ? null : await userFromRequest(req);
  if (!provider.mock && userId) {
    const denied = await reserveMeteredAction(userId, 'ai_explanation', req);
    if (denied) return denied;
  } else if (!provider.mock && trialInstall) {
    const denied = await reserveTrialAction(trialInstall, 'ai_explanation');
    if (denied) return denied;
  }

  if (userId) {
    const kind: 'selection' | 'ask' = payload.question || payload.variant === 'different' ? 'ask' : 'selection';
    const usage = await getStore().consumeUsage(userId, kind);
    if (!usage.allowed) {
      return Response.json(
        { error: 'quota_exceeded', kind, limit: usage.limit, message: quotaMessage(kind, usage.limit) },
        { status: 402 }
      );
    }
  }

  const system = buildSystemPrompt(payload);
  const user = buildUserPrompt(payload);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await provider.stream(system, user, (text) => send({ type: 'token', text }));
        send({ type: 'done', model: provider.name, mock: provider.mock });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
}
