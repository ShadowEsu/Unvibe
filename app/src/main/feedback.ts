/**
 * In-app feedback: stars plus up to 100 words, posted to unvibe.site. Validated here and again on
 * the server. The network and the app version come in as arguments so the error copy can be tested.
 */
import { serviceMessage } from '../core/serviceError';

export interface FeedbackInput {
  rating?: unknown;
  message?: unknown;
  email?: unknown;
}

export interface FeedbackDeps {
  fetcher: (url: string, init: RequestInit) => Promise<Response>;
  appVersion: string;
}

export type FeedbackResult = { ok: true } | { ok: false; error: string };

export async function sendFeedback(input: FeedbackInput | undefined, deps: FeedbackDeps): Promise<FeedbackResult> {
  const rating = typeof input?.rating === 'number' ? Math.round(input.rating) : 0;
  const message = typeof input?.message === 'string' ? input.message.trim().slice(0, 1200) : '';
  const email = typeof input?.email === 'string' ? input.email.trim().slice(0, 254) : '';
  if (rating < 1 || rating > 5) return { ok: false, error: 'Pick a star rating first.' };
  if (message && message.split(/\s+/).length > 100) return { ok: false, error: 'Keep it under 100 words.' };
  try {
    const response = await deps.fetcher('https://unvibe.site/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, message, email, source: 'app', appVersion: deps.appVersion }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: unknown };
    // The site's error text is shown only as a capped string.
    if (!response.ok) return { ok: false, error: serviceMessage({ message: body.error }) || 'Could not send feedback.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach unvibe.site. Check your connection and try again.' };
  }
}
