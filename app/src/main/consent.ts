import { app } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  aiSendAllowed,
  CONSENT_PROVIDERS,
  ConsentRequiredError,
  isConsentProvider,
  POLICY_VERSION,
  switchedOff,
  type ConsentItem,
  type ConsentProvider,
  type ConsentRecord,
} from '../core/consent';
import { readAiKey } from './aiKey';
import { settings } from './settings';

/**
 * The consent record lives in its own file, written only here: settings can be patched by any
 * renderer (settings:set), so neither the agreement nor its time comes from a renderer.
 * Every agreement and withdrawal is kept, oldest first. Erase everything leaves it: it records
 * what the person agreed to, not their work.
 */
class ConsentStore {
  private records: ConsentRecord[] = [];
  private readonly file = path.join(app.getPath('userData'), 'unvibe-consent.json');

  constructor() {
    try {
      const loaded = JSON.parse(readFileSync(this.file, 'utf8')) as { records?: unknown };
      if (Array.isArray(loaded.records)) {
        this.records = loaded.records.filter((record): record is ConsentRecord => isConsentProvider((record as ConsentRecord)?.provider));
      }
    } catch {
      /* no agreement yet */
    }
  }

  all(): readonly ConsentRecord[] {
    return this.records;
  }

  /** Throws when the file can't be written, so the app never acts on an agreement it didn't keep. */
  agree(items: ConsentItem[], provider: ConsentProvider, now: Date = new Date()): ConsentRecord {
    const record: ConsentRecord = { items, provider, policyVersion: POLICY_VERSION, agreedAt: now.toISOString() };
    this.write([...this.records, record]);
    return record;
  }

  /**
   * The off switch, for every provider at once; the records stay, each with its `revokedAt`.
   * Throws when it can't be saved, so the switch never shows off while sending is still allowed.
   */
  revoke(now: Date = new Date()): void {
    if (!this.records.some((record) => !record.revokedAt)) return;
    const at = now.toISOString();
    this.write(this.records.map((record) => (record.revokedAt ? record : { ...record, revokedAt: at })));
  }

  private write(records: ConsentRecord[]): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify({ records }), { mode: 0o600 });
    this.records = records;
  }
}

let instance: ConsentStore | null = null;

export function consentStore(): ConsentStore {
  instance ??= new ConsentStore();
  return instance;
}

/**
 * Who would receive the code right now: the user's own key's provider when "Use my own AI" is on,
 * or when the free allowance is used up and a key is saved (the automatic switch); otherwise
 * Google Gemini through Unvibe. `remaining` unknown means the switch isn't assumed.
 */
export function providerInUse(remaining?: number): ConsentProvider {
  const prefs = settings().all();
  const ownKey = Boolean(readAiKey()) && (prefs.useOwnAi || (remaining !== undefined && remaining <= 0));
  return ownKey && isConsentProvider(prefs.aiProvider) ? prefs.aiProvider : 'unvibe';
}

export function codeConsented(provider: ConsentProvider): boolean {
  return aiSendAllowed(consentStore().all(), provider);
}

/**
 * Runs right before every request that carries the user's code, diffs or questions (Security CC-1):
 * Unvibe's /api/v1/reviews (review.ts, studyQuiz.ts) and the three own-key calls (localAi.ts).
 */
export function requireCodeConsent(provider: ConsentProvider): void {
  if (!codeConsented(provider)) throw new ConsentRequiredError(provider);
}

/** The person turned sending off and hasn't agreed since: no global shortcuts (CC-5). */
export function sendingSwitchedOff(): boolean {
  return switchedOff(consentStore().all());
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
