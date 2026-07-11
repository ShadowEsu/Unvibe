import { selectProvider, buildComprehensionPrompt } from '@/ai';
import { parseQuestion } from '@/ai/comprehension';
import type { ReviewRequestPayload } from '@/ai/protocol';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const payload = (await req.json().catch(() => null)) as ReviewRequestPayload | null;
  if (!payload?.context) {
    return Response.json({ error: 'missing context' }, { status: 400 });
  }
  const provider = selectProvider();
  const { system, user } = buildComprehensionPrompt(payload);
  const text = await provider.complete(system, user);
  const question = parseQuestion(text);
  if (!question) {
    return Response.json({ error: 'model did not return a valid question' }, { status: 502 });
  }
  return Response.json(question);
}
