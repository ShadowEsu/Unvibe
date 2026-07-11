import type { ComprehensionQuestion, ReviewRequestPayload } from '../protocol';

/** Request a single comprehension question for the current review context (non-streaming). */
export async function fetchComprehension(
  backendUrl: string,
  payload: ReviewRequestPayload,
  signal?: AbortSignal,
): Promise<ComprehensionQuestion> {
  const res = await fetch(`${backendUrl.replace(/\/$/, '')}/api/v1/comprehension`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Uncode service returned ${res.status}`);
  }
  const data = (await res.json()) as ComprehensionQuestion;
  if (!data || typeof data.question !== 'string' || !Array.isArray(data.options)) {
    throw new Error('Malformed comprehension response');
  }
  return data;
}
