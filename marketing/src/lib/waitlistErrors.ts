export type WaitlistFailure = {
  code: "waitlist_storage_setup_required" | "waitlist_storage_unavailable" | "waitlist_save_failed";
  error: string;
  status: 500 | 503;
};

/**
 * Keeps infrastructure details in server logs while giving the form a useful,
 * non-sensitive state to render.
 */
export function publicWaitlistFailure(error: unknown): WaitlistFailure {
  const message = error instanceof Error ? error.message : "";

  if (/Durable waitlist storage is not configured|Waitlist encryption is not configured/i.test(message)) {
    return {
      code: "waitlist_storage_setup_required",
      error: "The private beta list is being configured. Please try again shortly.",
      status: 503,
    };
  }

  if (/waitlist storage|Vercel Blob|blob|fetch failed|timeout/i.test(message)) {
    return {
      code: "waitlist_storage_unavailable",
      error: "The private beta list is temporarily unavailable. Please try again shortly.",
      status: 503,
    };
  }

  return {
    code: "waitlist_save_failed",
    error: "We couldn't save your spot. Please try again.",
    status: 500,
  };
}
