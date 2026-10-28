import { CONSENT_PROVIDERS, isConsentProvider, POLICY_VERSION, type ConsentProvider } from '../core/consent';
import { readAiKey } from './aiKey';
import { codeConsented, sendingSwitchedOff } from './consentStore';
import { settings } from './settings';

/**
 * Who would receive the code right now: the person's own key's provider when "Use my own AI" is on,
 * or when the free allowance is used up and a key is saved (the automatic switch); otherwise
 * Google Gemini through Unvibe. With `remaining` unknown the automatic switch isn't assumed; the
 * check at the sender still catches it.
 */
export function providerInUse(remaining?: number): ConsentProvider {
  const prefs = settings().all();
  const ownKey = Boolean(readAiKey()) && (prefs.useOwnAi || (remaining !== undefined && remaining <= 0));
  return ownKey && isConsentProvider(prefs.aiProvider) ? prefs.aiProvider : 'unvibe';
}

export interface ConsentStatus {
  allowed: boolean;
  provider: ConsentProvider;
  providerName: string;
  ownKey: boolean;
  switchedOff: boolean;
  policyVersion: string;
}

/** What the panel and Settings show, for the provider in use now. */
export function consentStatus(remaining?: number): ConsentStatus {
  const provider = providerInUse(remaining);
  return {
    allowed: codeConsented(provider),
    provider,
    providerName: CONSENT_PROVIDERS[provider],
    ownKey: provider !== 'unvibe',
    switchedOff: sendingSwitchedOff(),
    policyVersion: POLICY_VERSION,
  };
}
