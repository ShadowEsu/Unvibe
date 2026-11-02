/**
 * Consent before the user's own content leaves this computer (Preston, BOSS ledger 299; Security's
 * consent audit U6, U7, U14, U15, U19, U20, U21, U36; gate conditions CC-1 to CC-7).
 *
 * Three separate, unticked agreements, all required before Unvibe sends any code, diff or question
 * of the user's to an AI provider: sending it to that provider, the Terms and Privacy Policy, and
 * being 18 or older. The agreement names the provider that actually receives the code: Anthropic
 * (Claude) through Unvibe, or the provider of the user's own key.
 * A different provider, or a new POLICY_VERSION, asks again. The off switch takes effect at once.
 * The built-in first-run sample, verbatim, isn't the user's content and needs none.
 */

/** Bump when what Unvibe sends, where, the screen's words, or the Terms/Privacy change.
 * 2026-10-30: Unvibe's server moved from Google Gemini to Anthropic (Claude), so everyone agrees again. */
export const POLICY_VERSION = '2026-10-30';

export const CONSENT_ITEMS = ['ai_send', 'terms', 'age_18'] as const;
export type ConsentItem = (typeof CONSENT_ITEMS)[number];

/**
 * Who receives the code: `unvibe` is Unvibe's server, which uses Anthropic (Claude); the rest are the
 * user's own key, sent straight from this computer (main/localAi.ts provider ids).
 */
export const CONSENT_PROVIDERS = {
  unvibe: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  grok: 'xAI (Grok)',
  deepseek: 'DeepSeek',
  kimi: 'Moonshot AI (Kimi)',
} as const;
export type ConsentProvider = keyof typeof CONSENT_PROVIDERS;

export function isConsentProvider(value: unknown): value is ConsentProvider {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CONSENT_PROVIDERS, value);
}

/**
 * Every word of the consent screen. `{provider}` is CONSENT_PROVIDERS[provider]. A test pins a hash
 * of this object to POLICY_VERSION, so changing the words without a new version fails (CC-3).
 */
export const CONSENT_COPY = {
  title: 'Before Vibe explains your code',
  leadUnvibe:
    'To write an explanation, Unvibe sends the code you select, paste or pick (with its file and project name), the git changes you explain in Briefs, and your questions and Chat messages to {provider}, through Unvibe\'s server.',
  leadOwnKey:
    'You chose your own {provider} key, so the code you select, paste or pick (with its file and project name), the git changes you explain in Briefs, and your questions and Chat messages go from this computer straight to {provider}, under your account with them.',
  secrets: 'Unvibe looks for keys and tokens on this computer first and stops, or asks you, before sending one. Nothing has been sent yet.',
  aiSend: 'Send my code and questions to {provider} to explain them',
  termsBefore: 'I agree to the ',
  terms: 'Terms',
  termsBetween: ' and the ',
  privacy: 'Privacy Policy',
  age18: 'I\'m 18 or older',
  offSwitch: 'You can turn this off any time in Settings, Privacy & Data.',
  incomplete: 'Tick all three boxes to continue.',
  continue: 'Continue',
  notNow: 'Not now',
} as const;

export function consentText(text: string, provider: ConsentProvider): string {
  return text.split('{provider}').join(CONSENT_PROVIDERS[provider]);
}

/** One agreement as stored on this computer: what, to whom, which policy, when; and when it was withdrawn. */
export interface ConsentRecord {
  items: ConsentItem[];
  provider: ConsentProvider;
  policyVersion: string;
  agreedAt: string;
  revokedAt?: string;
}

/**
 * May code go to `provider` now? Only if the newest record for that provider is of the current
 * policy, holds all three agreements and isn't withdrawn. `records` is oldest first.
 */
export function aiSendAllowed(records: readonly ConsentRecord[], provider: ConsentProvider, version: string = POLICY_VERSION): boolean {
  const latest = [...records].reverse().find((record) => record.provider === provider);
  return Boolean(
    latest
    && !latest.revokedAt
    && latest.policyVersion === version
    && CONSENT_ITEMS.every((item) => latest.items.includes(item)),
  );
}

/** The person's last action was the off switch: register no shortcuts until they agree again (CC-5). */
export function switchedOff(records: readonly ConsentRecord[]): boolean {
  return Boolean(records.at(-1)?.revokedAt);
}

/**
 * The renderer's form, checked in the main process: every box must be exactly `true` and the
 * provider one Unvibe knows. Anything else (missing, "true", 1) is no agreement.
 */
export function agreedItems(input: unknown): { items: ConsentItem[]; provider: ConsentProvider } | null {
  if (!input || typeof input !== 'object') return null;
  const form = input as Record<string, unknown>;
  if (!isConsentProvider(form.provider)) return null;
  return form.aiSend === true && form.terms === true && form.age18 === true
    ? { items: [...CONSENT_ITEMS], provider: form.provider }
    : null;
}

/** Thrown right before a send that has no agreement for its provider; nothing has left the computer. */
export class ConsentRequiredError extends Error {
  readonly code = 'consent_required';
  constructor(readonly provider: ConsentProvider) {
    super(`Nothing was sent. First agree to sending your code and questions to ${CONSENT_PROVIDERS[provider]}.`);
    this.name = 'ConsentRequiredError';
  }
}

/** The built-in first-run sample: Unvibe's own code, not the person's, so it needs no agreement. */
export const FIRST_RUN_SAMPLE = [
  'function debounce(fn, wait) {',
  '  let timer;',
  '  return (...args) => {',
  '    clearTimeout(timer);',
  '    timer = setTimeout(() => fn(...args), wait);',
  '  };',
  '}',
].join('\n');

/**
 * What a review starts from (Security CC-4): the built-in sample, code already captured, or a fresh
 * read of the person's selection or clipboard, and that read only once they have agreed to sending
 * code. Before the agreement nothing is read at all; the panel asks first.
 */
export async function reviewCapture<T extends { code: string | null; sourceApp?: string | null }>(
  options: { sample?: boolean; captured?: { code: string; sourceApp: string } },
  agreed: boolean,
  read: () => Promise<T>,
): Promise<T | { code: string | null; sourceApp: string | null }> {
  if (options.sample) return { code: FIRST_RUN_SAMPLE, sourceApp: 'Unvibe' };
  if (options.captured) return options.captured;
  return agreed ? read() : { code: null, sourceApp: null };
}

/**
 * Exempt only while the request carries nothing but the verbatim sample (Security CC-6): no typed
 * question, no diff, no file, no surrounding code. Any edit, or anything added, needs the agreement.
 */
export function isFirstRunSamplePayload(payload: {
  question?: string;
  context: { code?: string; enclosing?: string; diffHunks?: unknown[]; primaryFile?: string; imports: string[]; projectStructure: string[] };
}): boolean {
  const { context } = payload;
  return context.code === FIRST_RUN_SAMPLE
    && !payload.question
    && !context.enclosing
    && !context.diffHunks?.length
    && !context.primaryFile
    && context.projectStructure.length === 0
    && context.imports.every((line) => !line.startsWith('nearby:'));
}
