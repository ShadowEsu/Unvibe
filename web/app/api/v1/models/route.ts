import { listFreeChatModels, DEFAULT_OPENROUTER_MODEL } from '@/ai';

export const runtime = 'nodejs';

/** Public catalog of free chat models available on Unvibe cloud AI. */
export async function GET(): Promise<Response> {
  return Response.json({
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    models: listFreeChatModels(),
  });
}
