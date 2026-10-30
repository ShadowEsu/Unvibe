/**
 * The in-app product-market-fit survey (Sean Ellis / Superhuman wording, ledger 361, FE-09).
 * Pure rules only: who sees the card, what the first-run timestamp is, and the exact request body.
 * Answers stay on this computer as a draft until the person presses Send; nothing here sends.
 */
import type { LocalEvent } from './learning';

export const PMF_MIN_EXPLANATIONS = 3;
export const PMF_MIN_DAYS = 3;
export const PMF_CONSENT = 'pmf-v1';
export const PMF_MAX_ANSWER_CHARS = 1000;
const DAY_MS = 86_400_000;

export const PMF_Q1_OPTIONS = [
  { id: 'very', label: 'Very disappointed' },
  { id: 'somewhat', label: 'Somewhat disappointed' },
  { id: 'not', label: 'Not disappointed' },
  { id: 'na', label: 'N/A, I no longer use it' },
] as const;
export type PmfQ1 = (typeof PMF_Q1_OPTIONS)[number]['id'];

/** The spec's wording, unchanged, with Unvibe as the product. */
export const PMF_QUESTIONS = {
  q1: 'How would you feel if you could no longer use Unvibe?',
  q2: 'What type of people do you think would most benefit from Unvibe?',
  q3: 'What is the main benefit you receive from Unvibe?',
  q4: 'How can we improve Unvibe for you?',
} as const;

export const PMF_CONSENT_LINE =
  "Send shares these answers, how many explanations you've had and how many days since install with Unvibe, under an anonymous install ID. Nothing leaves your Mac until you press Send.";

/** `sent`: the server has the answer (201, or 409 already answered). `dismissed`: Not now or ×. */
export type PmfStatus = 'sent' | 'dismissed';

export interface PmfDraft {
  q1: PmfQ1 | '';
  q2: string;
  q3: string;
  q4: string;
}

export const EMPTY_PMF_DRAFT: PmfDraft = { q1: '', q2: '', q3: '', q4: '' };

export interface PmfEligibilityInput {
  explanations: number;
  /** ISO time of this install's first run; missing or unreadable means not eligible. */
  firstRunAt: string | undefined;
  status: PmfStatus | undefined;
  now: Date;
}

/** At least 3 completed explanations, at least 3 full days since the first run, never sent or dismissed. */
export function pmfEligible({ explanations, firstRunAt, status, now }: PmfEligibilityInput): boolean {
  if (status) return false;
  if (explanations < PMF_MIN_EXPLANATIONS) return false;
  const first = firstRunAt ? Date.parse(firstRunAt) : Number.NaN;
  if (Number.isNaN(first)) return false;
  return now.getTime() - first >= PMF_MIN_DAYS * DAY_MS;
}

/** Whole days since the first run, as the server stores it (0 to 3650). */
export function daysSinceFirstRun(firstRunAt: string, now: Date): number {
  const days = Math.floor((now.getTime() - Date.parse(firstRunAt)) / DAY_MS);
  return Number.isFinite(days) ? Math.min(3650, Math.max(0, days)) : 0;
}

/**
 * Completed explanations the person asked for: `explanation_completed` records, and records from
 * before activity metadata existed (all explanations then). The built-in first-run sample and
 * day-active markers don't count.
 */
export function completedExplanations(events: readonly LocalEvent[]): number {
  return events.filter((event) => event.eventType !== 'day_active' && !event.sample).length;
}

/**
 * The first-run timestamp to store when none is stored yet: the earliest valid time among the
 * evidence this computer has (the beta trial start, the oldest saved explanation), else `now`. An
 * install that updates into this version is never treated as newer than its own records show.
 */
export function earliestFirstRun(candidates: ReadonlyArray<string | undefined>, now: Date): string {
  let earliest = now.getTime();
  for (const candidate of candidates) {
    const at = candidate ? Date.parse(candidate) : Number.NaN;
    if (!Number.isNaN(at) && at < earliest) earliest = at;
  }
  return new Date(earliest).toISOString();
}

function cappedText(value: unknown): string {
  return typeof value === 'string' ? Array.from(value).slice(0, PMF_MAX_ANSWER_CHARS).join('') : '';
}

/** A draft from the renderer or the store file, with anything unexpected dropped. */
export function cleanPmfDraft(input: unknown): PmfDraft {
  if (!input || typeof input !== 'object') return { ...EMPTY_PMF_DRAFT };
  // Every field is read as unknown and checked below, so the cast claims nothing about values.
  const raw = input as Partial<Record<keyof PmfDraft, unknown>>;
  const q1 = PMF_Q1_OPTIONS.find((option) => option.id === raw.q1)?.id ?? '';
  return { q1, q2: cappedText(raw.q2), q3: cappedText(raw.q3), q4: cappedText(raw.q4) };
}

export interface PmfRequestBody {
  q1: PmfQ1;
  q2: string;
  q3: string;
  q4: string;
  explanations: number;
  daysSinceInstall: number;
  appVersion: string;
  consent: typeof PMF_CONSENT;
}

/** The POST /api/v1/feedback/pmf body, or null when Q1 is unanswered (Send stays disabled). */
export function pmfRequestBody(draft: PmfDraft, context: { explanations: number; daysSinceInstall: number; appVersion: string }): PmfRequestBody | null {
  if (!draft.q1) return null;
  return {
    q1: draft.q1,
    q2: draft.q2.trim(),
    q3: draft.q3.trim(),
    q4: draft.q4.trim(),
    explanations: Math.min(100_000, Math.max(0, Math.floor(context.explanations))),
    daysSinceInstall: context.daysSinceInstall,
    appVersion: context.appVersion,
    consent: PMF_CONSENT,
  };
}
