import type { ReviewRequestPayload } from '@/ai/protocol';

/** Largest review context (serialized) the AI routes accept. */
export const MAX_CONTEXT_CHARS = 120_000;
/** Largest follow-up question the AI routes accept. */
export const MAX_QUESTION_CHARS = 4_000;

/** The characters a request sends to the AI (its serialized context and question), as the fair-use rate limit counts them. */
export function payloadCharacters(payload: ReviewRequestPayload): number {
  return JSON.stringify(payload.context).length + (typeof payload.question === 'string' ? payload.question.length : 0);
}

/**
 * Size checks shared by every route that sends a review payload to the AI. Returns the refusal
 * (400 for a non-text question, 413 when too long), or null when the payload may go ahead.
 */
export function payloadSizeError(payload: ReviewRequestPayload): Response | null {
  if (JSON.stringify(payload.context).length > MAX_CONTEXT_CHARS) {
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
