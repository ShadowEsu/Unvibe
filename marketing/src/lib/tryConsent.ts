/**
 * The Try it consent version, sent as `consent.v` with every request to /api/v1/try.
 * Must equal `TRY_CONSENT_VERSION` in web/src/lib/tryDemo.ts, or the API refuses every request.
 */
export const TRY_CONSENT_VERSION = "2026-10-29";

/** localStorage key holding `{"v":TRY_CONSENT_VERSION,"aiSend":true,"age18":true,"at":<ISO time>}`. */
export const TRY_CONSENT_KEY = "unvibe.tryConsent";

export type TryConsentTicks = { aiSend: boolean; age18: boolean };

/** Why Explain it didn't send: shown next to each box still unticked, only after a press (Design W18). */
export const TRY_CONSENT_REASONS: Record<keyof TryConsentTicks, string> = {
  aiSend: "Tick this box to send the code. Nothing is sent until you do.",
  age18: "Tick this box to confirm you're 18 or older.",
};

/** The reason for each unticked box once Explain it was pressed; nothing before a press. */
export function tryConsentReasons(ticks: TryConsentTicks, pressed: boolean): Record<keyof TryConsentTicks, string> {
  return {
    aiSend: pressed && !ticks.aiSend ? TRY_CONSENT_REASONS.aiSend : "",
    age18: pressed && !ticks.age18 ? TRY_CONSENT_REASONS.age18 : "",
  };
}

/** The stored ticks: each box counts as ticked only if the version matches and its flag is exactly `true`. */
export function storedTryConsent(raw: string | null): TryConsentTicks {
  let value: unknown = null;
  try {
    value = JSON.parse(raw ?? "null");
  } catch {
    // Not JSON: unticked.
  }
  if (typeof value !== "object" || value === null || !("v" in value) || value.v !== TRY_CONSENT_VERSION) {
    return { aiSend: false, age18: false };
  }
  return { aiSend: "aiSend" in value && value.aiSend === true, age18: "age18" in value && value.age18 === true };
}
