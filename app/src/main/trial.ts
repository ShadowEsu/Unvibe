/**
 * Sealed trial builds bake an opaque Unvibe trial token (never a provider API key).
 * The hosted backend holds Gemini/Anthropic keys and meters each install.
 */

const BAKED_TRIAL_TOKEN = process.env.UNVIBE_RELEASE_TRIAL_TOKEN || '';

export function bakedTrialToken(): string {
  return BAKED_TRIAL_TOKEN.trim();
}

export function trialBuildEnabled(): boolean {
  return bakedTrialToken().length > 0;
}
