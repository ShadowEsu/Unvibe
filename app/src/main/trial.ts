/**
 * Sealed trial builds bake an opaque Unvibe trial token (never a provider API key).
 * The hosted backend holds Gemini/Anthropic keys and meters each install.
 */

const BAKED_TRIAL_TOKEN = process.env.UNVIBE_RELEASE_TRIAL_TOKEN || '';
/** Founder/full-product builds deliberately have no local feature or usage gates. */
const BAKED_FULL_PRODUCT = process.env.UNVIBE_RELEASE_FULL_PRODUCT === '1';

export function bakedTrialToken(): string {
  return BAKED_TRIAL_TOKEN.trim();
}

export function trialBuildEnabled(): boolean {
  return bakedTrialToken().length > 0;
}

export function fullProductBuildEnabled(): boolean {
  return BAKED_FULL_PRODUCT;
}
