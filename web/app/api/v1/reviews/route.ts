import { selectProvider, buildSystemPrompt, buildUserPrompt } from '@/ai';
import type { ReviewRequestPayload, StreamEvent } from '@/ai/protocol';
import { userFromRequest, unauthorized } from '@/lib/auth';
import { getStore } from '@/data/store';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) return unauthorized();
  const payload = (await req.json().catch(() => null)) as ReviewRequestPayload | null;
  if (!payload?.scope || !payload?.level || !payload?.context) {
    return Response.json({ error: 'missing scope, level, or context' }, { status: 400 });
  }

  const requestId = req.headers.get('x-uncode-request-id') ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return Response.json({ error: 'x-uncode-request-id must be a UUID' }, { status: 400 });
  }
  const usage = await getStore().reserveExplanation(userId, requestId);
  if (!usage) {
    return Response.json(
      { error: 'This month\'s explanation limit has been reached. Learning, saved material, and comprehension checks remain free.' },
      { status: 429 }
    );
  }

  const provider = selectProvider();
  const system = buildSystemPrompt(payload);
  const user = buildUserPrompt(payload);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await provider.stream(system, user, (text) => send({ type: 'token', text }));
        await getStore().completeExplanation(userId, requestId);
        send({ type: 'done', model: provider.name, mock: provider.mock });
      } catch (err) {
        await getStore().releaseExplanation(userId, requestId).catch(() => undefined);
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
}
