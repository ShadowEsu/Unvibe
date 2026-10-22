/** What the explanation panel shows when the service refuses or fails a request. */
export interface ExplanationFailure {
  message: string;
  /** True when the plan's allowance is used up, so the panel offers the Plan page. */
  planLimit: boolean;
}

/**
 * Plain-language failure for a non-OK /api/v1/reviews response. 429 `plan_limit_reached` is the
 * current allowance signal; 402 `quota_exceeded` is what services before the plan-metering fix
 * returned, and is still an allowance message, never a bare status code.
 */
export function explanationFailure(status: number, body: { error?: string; message?: string }): ExplanationFailure {
  if (status === 401) {
    return { message: 'Sign in to use cloud explanations, or continue with local learning history.', planLimit: false };
  }
  if (status === 429 || status === 402 || body.error === 'plan_limit_reached' || body.error === 'quota_exceeded') {
    return {
      message: body.message ?? 'You have used this plan\'s explanations for now. Open Plan & usage to see when they reset or to upgrade.',
      planLimit: true,
    };
  }
  if (status === 413) {
    return { message: body.message ?? 'That is too much to send in one go. Select less code or shorten your question, then try again.', planLimit: false };
  }
  if (status >= 500) {
    return { message: body.message ?? 'The explanation service is temporarily unavailable. Please try again shortly.', planLimit: false };
  }
  return { message: body.message ?? 'The explanation service could not complete that request. Please try again.', planLimit: false };
}
