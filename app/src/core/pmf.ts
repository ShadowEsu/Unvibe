/**
 * The in-app product-market-fit survey (Sean Ellis / Superhuman wording, ledger 361, FE-09), built
 * to Security's requirements (boss-handoff security/20261030-0728). Pure rules only: who sees the
 * card, what the first-run timestamp is, the secret check and the exact request body. Answers stay
 * on this computer as a draft until the person presses Send; nothing here sends. The explanation
 * count and first run decide eligibility on this computer only and are never sent.
 */
import type { LocalEvent } from './learning';
import { scanBlocks } from './secretFilter';

export const PMF_MIN_EXPLANATIONS = 3;
export const PMF_MIN_DAYS = 3;
export const PMF_CONSENT = 'pmf-v1';
/** Per text answer, in UTF-16 units like the textarea's maxLength; the server refuses more. */
export const PMF_MAX_ANSWER_CHARS = 2000;
/** The server's body limit; ordinary text never comes close, but a full page of emoji could. */
export const PMF_MAX_BODY_BYTES = 16_384;
/** The short note under Other in the "where did you first hear" question; the server refuses more. */
export const PMF_MAX_HEARD_OTHER_CHARS = 80;
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

/** One optional question after the four (attribution, ledger 453). Fixed choices, ids as the server's. */
export const PMF_HEARD_QUESTION = 'Where did you first hear about Unvibe?';
export const PMF_HEARD_OPTIONS = [
  { id: 'search', label: 'Search' },
  { id: 'friend', label: 'A friend or colleague' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'hacker_news', label: 'Hacker News' },
  { id: 'x', label: 'X' },
  { id: 'youtube_tiktok', label: 'YouTube or TikTok' },
  { id: 'directory', label: 'A directory or list' },
  { id: 'other', label: 'Other' },
] as const;
export type PmfHeard = (typeof PMF_HEARD_OPTIONS)[number]['id'];

/** Security's wording, next to Send. */
export const PMF_CONSENT_LINE =
  "Your answers and a random install ID go to Unvibe's server so the team can read them. Nothing is sent until you press Send. Don't include passwords, keys or other people's personal details.";

/** Security's wording when the app's secret filter finds anything in a text answer. */
export const PMF_SECRET_BLOCKED = 'That looks like a key or password. Take it out and try again.';

/**
 * `shown`: the card appeared in some run of the app; it stays for that run only (one panel session).
 * `sent`: the server has the answer (201, or 409 already answered). `dismissed`: Not now or ×.
 */
export type PmfStatus = 'shown' | 'sent' | 'dismissed';

export interface PmfDraft {
  q1: PmfQ1 | '';
  q2: string;
  q3: string;
  q4: string;
  /** Optional; '' when unanswered. */
  heard: PmfHeard | '';
  /** The note under Other; kept in the draft if the choice changes, but sent only with Other. */
  heardOther: string;
}

export const EMPTY_PMF_DRAFT: PmfDraft = { q1: '', q2: '', q3: '', q4: '', heard: '', heardOther: '' };

export interface PmfEligibilityInput {
  explanations: number;
  /** ISO time of this install's first run; missing or unreadable means not eligible. */
  firstRunAt: string | undefined;
  status: PmfStatus | undefined;
  /** The card was shown earlier in this run of the app (memory only; a restart clears it). */
  shownThisRun: boolean;
  now: Date;
}

/**
 * At least 3 completed explanations, at least 3 full days since the first run, and either never
 * shown, or shown in this same run. Never after Send or close, and never in a later run.
 */
export function pmfEligible({ explanations, firstRunAt, status, shownThisRun, now }: PmfEligibilityInput): boolean {
  if (status && !(status === 'shown' && shownThisRun)) return false;
  if (explanations < PMF_MIN_EXPLANATIONS) return false;
  const first = firstRunAt ? Date.parse(firstRunAt) : Number.NaN;
  if (Number.isNaN(first)) return false;
  return now.getTime() - first >= PMF_MIN_DAYS * DAY_MS;
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

function cappedText(value: unknown, max = PMF_MAX_ANSWER_CHARS): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** A draft from the renderer or the store file, with anything unexpected dropped. */
export function cleanPmfDraft(input: unknown): PmfDraft {
  if (!input || typeof input !== 'object') return { ...EMPTY_PMF_DRAFT };
  // Every field is read as unknown and checked below, so the cast claims nothing about values.
  const raw = input as Partial<Record<keyof PmfDraft, unknown>>;
  const q1 = PMF_Q1_OPTIONS.find((option) => option.id === raw.q1)?.id ?? '';
  const heard = PMF_HEARD_OPTIONS.find((option) => option.id === raw.heard)?.id ?? '';
  return {
    q1,
    q2: cappedText(raw.q2),
    q3: cappedText(raw.q3),
    q4: cappedText(raw.q4),
    heard,
    heardOther: cappedText(raw.heardOther, PMF_MAX_HEARD_OTHER_CHARS),
  };
}

/** The free-text answers, in the order the card shows them: the 3 questions, then the Other note. */
export type PmfTextKey = 'q2' | 'q3' | 'q4' | 'heardOther';

/**
 * The app's secret filter (the one explanations and typed questions go through) over the text
 * answers, the Other note included when it would be sent. Any finding, a known credential or a
 * high-entropy string, blocks Send, as for Chat. Returns the first flagged answer, so the card can
 * show the message under it, or null.
 */
export function pmfSecretField(draft: PmfDraft): PmfTextKey | null {
  const findings = scanBlocks([
    { file: 'q2', text: draft.q2 },
    { file: 'q3', text: draft.q3 },
    { file: 'q4', text: draft.q4 },
    { file: 'heardOther', text: draft.heard === 'other' ? draft.heardOther : '' },
  ]);
  return (['q2', 'q3', 'q4', 'heardOther'] as const).find((key) => findings.some((f) => f.file === key)) ?? null;
}

/**
 * Only the answers and the app version; the install ID travels in the trial header. `heard` is
 * present only when that question was answered, and `heardOther` only with Other and a note, so a
 * skipped question sends exactly what earlier versions sent.
 */
export interface PmfRequestBody {
  q1: PmfQ1;
  q2: string;
  q3: string;
  q4: string;
  heard?: PmfHeard;
  heardOther?: string;
  appVersion: string;
  consent: typeof PMF_CONSENT;
}

/** The POST /api/v1/feedback/pmf body, or null when Q1 is unanswered (Send stays disabled). */
export function pmfRequestBody(draft: PmfDraft, appVersion: string): PmfRequestBody | null {
  if (!draft.q1) return null;
  const heardOther = draft.heard === 'other' ? draft.heardOther.trim() : '';
  return {
    q1: draft.q1,
    q2: draft.q2.trim(),
    q3: draft.q3.trim(),
    q4: draft.q4.trim(),
    ...(draft.heard ? { heard: draft.heard } : {}),
    ...(heardOther ? { heardOther } : {}),
    appVersion,
    consent: PMF_CONSENT,
  };
}
