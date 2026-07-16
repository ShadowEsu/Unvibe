import { selectProvider, buildComprehensionPrompt } from '@/ai';
import { parseQuestion } from '@/ai/comprehension';
import type { ReviewRequestPayload } from '@/ai/protocol';
import { aiRequestRequiresSession } from '@/lib/aiAccess';
import { unauthorized, userFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const provider = selectProvider();
  if (aiRequestRequiresSession(provider.mock) && !(await userFromRequest(req))) {
    return unauthorized();
  }
  const payload = (await req.json().catch(() => null)) as ReviewRequestPayload | null;
  if (!payload?.context) {
    return Response.json({ error: 'missing context' }, { status: 400 });
  }
  if (JSON.stringify(payload.context).length > 120_000) {
    return Response.json({ error: 'review context exceeds the 120,000 character limit' }, { status: 413 });
  }
  const { system, user } = buildComprehensionPrompt(payload);
  const text = await provider.complete(system, user);
  const question = parseQuestion(text);
  if (!question) {
    return Response.json({ error: 'model did not return a valid question' }, { status: 502 });
  }
  return Response.json(question);
}
