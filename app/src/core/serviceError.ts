/** What the explanation panel shows when the service refuses or fails a request. */
export interface ExplanationFailure {
  message: string;
  /** True when the plan's allowance is used up, so the panel offers the Plan page. */
  planLimit: boolean;
  /** True when the request needs Pro (server 402 `pro_required`), so the panel shows the Pro upgrade. */
  proRequired: boolean;
}

/**
 * Shown when the server's 429 `fair_use_rate_limited` (the anti-abuse rate limit, not a used-up
 * allowance) arrives without its own message.
 */
export const FAIR_USE_RATE_LIMITED_FALLBACK = 'You\'ve reached the fair-use rate limit against automated abuse. Try again in a few minutes.';

/**
 * A service `message` shown to the person as plain text: only a string, trimmed and cut to 300
 * characters; '' when absent or not a string. Every message the service sends goes through here.
 */
export function serviceMessage(body: unknown): string {
  const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
  return typeof message === 'string' ? message.trim().slice(0, 300) : '';
}

/**
 * Plain-language failure for a non-OK /api/v1/reviews response. 402 `pro_required` is the server's
 * Pro gate (diff, brief and compare reviews on Free or the trial) and opens the Pro upgrade panel.
 * 429 `plan_limit_reached` is the current allowance signal; any other 402 (`quota_exceeded`, what
 * services before the plan-metering fix returned) is still an allowance message, never a bare
 * status code. 429 `fair_use_rate_limited` is the anti-abuse rate limit: the server's message as
 * is, with no Plan page, limit pause or upgrade.
 */
export function explanationFailure(status: number, body: { error?: unknown; message?: unknown }): ExplanationFailure {
  const message = serviceMessage(body);
  if (status === 401) {
    return { message: 'Sign in to use cloud explanations, or continue with local learning history.', planLimit: false, proRequired: false };
  }
  if (body.error === 'fair_use_rate_limited') {
    return { message: message || FAIR_USE_RATE_LIMITED_FALLBACK, planLimit: false, proRequired: false };
  }
  if (body.error === 'pro_required') {
    return { message: message || 'This review is included with Unvibe Pro.', planLimit: false, proRequired: true };
  }
  if (status === 429 || status === 402 || body.error === 'plan_limit_reached' || body.error === 'quota_exceeded') {
    return {
      message: message || 'You have used this plan\'s explanations for now. Open Plan & usage to see when they reset or to upgrade.',
      planLimit: true,
      proRequired: false,
    };
  }
  if (status === 413) {
    return { message: message || 'That is too much to send in one go. Select less code or shorten your question, then try again.', planLimit: false, proRequired: false };
  }
  if (status >= 500) {
    return { message: message || 'The explanation service is temporarily unavailable. Please try again shortly.', planLimit: false, proRequired: false };
  }
  return { message: message || 'The explanation service could not complete that request. Please try again.', planLimit: false, proRequired: false };
}
