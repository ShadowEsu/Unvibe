import type { ReviewRequestPayload } from '@/ai/protocol';

/** Largest review context (serialized) the AI routes accept, in UTF-16 units. */
export const MAX_CONTEXT_CHARS = 120_000;
/**
 * The same cap in UTF-8 bytes. The spend meter holds a call's input at one token per byte, so CJK or
 * emoji under the character cap could still be held above an account's $1 daily share and be refused
 * as a spent limit. 200,000 bytes keeps the largest call (with a 4,000-character question) under it.
 */
export const MAX_CONTEXT_BYTES = 200_000;
/** Largest follow-up question the AI routes accept. */
export const MAX_QUESTION_CHARS = 4_000;

/**
 * Size checks shared by every route that sends a review payload to the AI. Returns the refusal
 * (400 for a non-text question, 413 when too long), or null when the payload may go ahead.
 */
export function payloadSizeError(payload: ReviewRequestPayload): Response | null {
  const context = JSON.stringify(payload.context);
  if (context.length > MAX_CONTEXT_CHARS || Buffer.byteLength(context, 'utf8') > MAX_CONTEXT_BYTES) {
    return Response.json({
      error: 'context_too_long',
      message: 'That is too much code to explain at once. Select a smaller part and try again.',
    }, { status: 413 });
  }
  if (payload.question !== undefined && typeof payload.question !== 'string') {
    return Response.json({ error: 'invalid_question', message: 'The follow-up question must be text.' }, { status: 400 });
  }
  if (payload.question && payload.question.length > MAX_QUESTION_CHARS) {
    return Response.json({
      error: 'question_too_long',
      message: 'That question is too long. Keep it under 4,000 characters and try again.',
    }, { status: 413 });
  }
  return null;
}
