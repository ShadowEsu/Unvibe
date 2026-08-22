export const BUILD_STATUS_STORAGE_ERROR_CODE = "BUILD_STATUS_STORAGE_UNAVAILABLE";

export const BUILD_STATUS_STORAGE_ERROR =
  "The public timer could not be saved. Please try again.";

export type BuildStatusErrorPayload = {
  code?: string;
  error?: string;
};

/**
 * Keeps platform errors out of the founder-facing UI. The endpoint can still
 * log the underlying error server-side for diagnosis.
 */
export function founderActionFailureMessage(
  status: number,
  payload: BuildStatusErrorPayload | null,
): string {
  if (status === 401) return "That founder passcode is incorrect.";
  if (payload?.code === BUILD_STATUS_STORAGE_ERROR_CODE) return BUILD_STATUS_STORAGE_ERROR;
  return "Couldn’t save that update. Please try again.";
}
