/**
 * Pure local learning model — records of what the user reviewed and understood, and the
 * derived stats the companion app shows. No I/O here; the main-process store persists these
 * and the backend mirrors them when signed in. Unit tested.
 */

export type Outcome = 'reviewed' | 'understood' | 'needs_review';
export type ActivityType = 'explanation_completed';
export type SkillState = 'New' | 'Developing' | 'Familiar' | 'Strong' | 'Needs review' | 'Insufficient evidence';

export interface LocalEvent {
  id: string;
  ts: string; // ISO
  eventType?: ActivityType; // optional only for records created before activity metadata existed
  localDate?: string; // YYYY-MM-DD at the time of the activity
  timezone?: string; // IANA timezone captured at the time of the activity
  scope: string;
  level: string;
  outcome: Outcome;
  lines: number;
  language?: string;
  sourceApp?: string;
  file?: string;
  project?: string;
  concept?: string;
  conceptLabel?: string;
  /** Local-only teaching content — never synced to the cloud. */
  code?: string;
  /** Local-only explanation text — never synced to the cloud. */
  explanation?: string;
}

export interface Usage {
  label: string;
  pct: number;
}

export interface Profile {
  reviews: number;
  understood: number;
  needsReview: number;
  linesUnderstood: number;
  linesReviewed: number;
  conceptsSeen: number;
  conceptsDeveloping: number;
  conceptsFamiliar: number;
  conceptsStrong: number;
  conceptsNeedReview: number;
  streak: number;
  bestStreak: number;
  usage: Usage[];
  /** Intensity 0..3 per day, oldest→newest, ending today. Length = HEAT_DAYS. */
  heat: number[];
  lastActive?: string;
}

export interface FeedItem {
  id: string;
  ts: string;
  title: string;
  meta: string;
  outcome: Outcome;
}

/** Learning view item. Code/explanation stay on-device when present. */
export interface LearningItem extends FeedItem {
  concept?: string;
  level: string;
  lines: number;
  file?: string;
  project?: string;
  scope?: string;
  dueLabel?: string;
  language?: string;
  code?: string;
  explanation?: string;
}

/** Strip local-only lesson bodies before any remote sync. */
export function forSync(event: LocalEvent): LocalEvent {
  const { code: _code, explanation: _explanation, ...rest } = event;
  return rest;
}

export const HEAT_DAYS = 182;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eventDay(event: LocalEvent): string {
  return event.localDate ?? dayKey(event.ts);
}

function shift(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function currentStreak(days: Set<string>, todayKey: string): number {
  let cursor: string;
  if (days.has(todayKey)) cursor = todayKey;
  else if (days.has(shift(todayKey, -1))) cursor = shift(todayKey, -1);
  else return 0;
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor = shift(cursor, -1);
  }
  return n;
}

export function bestStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  const sorted = [...days].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = shift(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

const APP_BUCKETS: Array<{ label: string; re: RegExp }> = [
  { label: 'Editors & IDEs', re: /code|cursor|vscode|xcode|jetbrains|intellij|webstorm|pycharm|goland|rubymine|clion|sublime|\bvim\b|neovim|nova|\bzed\b|atom|fleet|android studio/i },
  { label: 'Terminal', re: /terminal|iterm|warp|kitty|alacritty|tmux|hyper|wezterm/i },
  { label: 'Browser & docs', re: /chrome|safari|firefox|arc|edge|brave|opera|vivaldi/i },
];

function bucket(app?: string): string {
  if (!app) return 'Other';
  return APP_BUCKETS.find((b) => b.re.test(app))?.label ?? 'Other';
}

export function computeProfile(events: LocalEvent[], todayKey: string): Profile {
  const days = new Set(events.map(eventDay));

  const conceptEvents = new Map<string, LocalEvent[]>();
  for (const e of events) {
    if (!e.concept) continue;
    const evidence = conceptEvents.get(e.concept) ?? [];
    evidence.push(e);
    conceptEvents.set(e.concept, evidence);
  }

  const usageCounts = new Map<string, number>();
  for (const e of events) {
    const b = bucket(e.sourceApp);
    usageCounts.set(b, (usageCounts.get(b) ?? 0) + 1);
  }
  const usageTotal = [...usageCounts.values()].reduce((a, b) => a + b, 0);
  const usage: Usage[] = [...usageCounts.entries()]
    .map(([label, n]) => ({ label, pct: usageTotal ? Math.round((n / usageTotal) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  const perDay = new Map<string, number>();
  for (const e of events) perDay.set(eventDay(e), (perDay.get(eventDay(e)) ?? 0) + 1);
  const heat: number[] = [];
  for (let i = HEAT_DAYS - 1; i >= 0; i--) {
    const c = perDay.get(shift(todayKey, -i)) ?? 0;
    heat.push(c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : 3);
  }

  return {
    reviews: events.length,
    understood: events.filter((e) => e.outcome === 'understood').length,
    needsReview: events.filter((e) => e.outcome === 'needs_review').length,
    linesReviewed: events.reduce((a, e) => a + e.lines, 0),
    linesUnderstood: events.filter((e) => e.outcome === 'understood').reduce((a, e) => a + e.lines, 0),
    conceptsSeen: conceptEvents.size,
    conceptsDeveloping: [...conceptEvents.values()].filter((e) => deriveSkillState(e) === 'Developing').length,
    conceptsFamiliar: [...conceptEvents.values()].filter((e) => deriveSkillState(e) === 'Familiar').length,
    conceptsStrong: [...conceptEvents.values()].filter((e) => deriveSkillState(e) === 'Strong').length,
    conceptsNeedReview: [...conceptEvents.values()].filter((e) => deriveSkillState(e) === 'Needs review').length,
    streak: currentStreak(days, todayKey),
    bestStreak: bestStreak(days),
    usage,
    heat,
    lastActive: events.length ? events[events.length - 1].ts : undefined,
  };
}

/** Cautious evidence label: one correct check is developing, never “mastered.” */
export function deriveSkillState(events: LocalEvent[]): SkillState {
  if (events.length === 0) return 'Insufficient evidence';
  const chronological = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  const latest = chronological[chronological.length - 1];
  if (latest.outcome === 'needs_review') return 'Needs review';
  const correct = chronological.filter((event) => event.outcome === 'understood').length;
  if (correct >= 3) return 'Strong';
  if (correct >= 2) return 'Familiar';
  if (correct === 1) return 'Developing';
  return latest.outcome === 'reviewed' ? 'New' : 'Insufficient evidence';
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  reviewed: 'Reviewed',
  understood: 'Understood',
  needs_review: 'To revisit',
};

export function computeFeed(events: LocalEvent[], limit: number): FeedItem[] {
  return computeLearningItems(events, limit).map(({ id, ts, title, meta, outcome }) => ({ id, ts, title, meta, outcome }));
}

export function computeLearningItems(events: LocalEvent[], limit: number): LearningItem[] {
  return [...events]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit)
    .map((e) => toLearningItem(e));
}

function toLearningItem(e: LocalEvent, dueLabel?: string): LearningItem {
  return {
    id: e.id,
    ts: e.ts,
    title: e.conceptLabel ?? (e.file ? pathTitle(e.file) : `${e.lines} lines of ${e.language ?? 'code'}`),
    meta: [e.scope && e.scope !== 'selection' ? e.scope : undefined, e.sourceApp, OUTCOME_LABEL[e.outcome]].filter(Boolean).join(' · '),
    outcome: e.outcome,
    concept: e.conceptLabel ?? e.concept,
    level: e.level,
    lines: e.lines,
    file: e.file,
    project: e.project,
    scope: e.scope,
    language: e.language,
    code: e.code,
    explanation: e.explanation,
    ...(dueLabel ? { dueLabel } : {}),
  };
}

function pathTitle(file: string): string {
  const parts = file.split(/[/\\]/);
  return parts[parts.length - 1] || file;
}

/**
 * Spaced review queue: needs_review first, then understood items past 1/3/7 day intervals.
 */
export function computeReviewQueue(events: LocalEvent[], now = new Date(), limit = 20): LearningItem[] {
  const nowMs = now.getTime();
  const intervalsDays = [1, 3, 7, 14];

  const needs = events
    .filter((e) => e.outcome === 'needs_review')
    .sort((a, b) => b.ts.localeCompare(a.ts));

  const understood = events
    .filter((e) => e.outcome === 'understood')
    .sort((a, b) => a.ts.localeCompare(b.ts));

  const dueUnderstood: Array<LocalEvent & { dueLabel: string }> = [];
  for (const e of understood) {
    const ageDays = Math.floor((nowMs - new Date(e.ts).getTime()) / 86_400_000);
    const hits = intervalsDays.filter((d) => ageDays >= d);
    if (hits.length === 0) continue;
    dueUnderstood.push({ ...e, dueLabel: `${hits[hits.length - 1]}d revisit` });
  }
  dueUnderstood.sort((a, b) => a.ts.localeCompare(b.ts));

  const merged = [...needs.map((e) => ({ ...e, dueLabel: 'Needs review' as string })), ...dueUnderstood]
    .slice(0, limit);

  // Preserve queue order (needs_review first); do not re-sort by recency.
  return merged.map((e) => toLearningItem(e, e.dueLabel));
}

// ---- Milestones -------------------------------------------------------------
// Tasteful learning milestones, derived only from real recorded events. A milestone
// fires once, the moment a new event crosses its threshold — never fabricated.

export type MilestoneId =
  | 'first_explanation'
  | 'hundred_explanations'
  | 'ten_concepts'
  | 'five_languages'
  | 'streak_3'
  | 'streak_7';

export interface Milestone {
  id: MilestoneId;
  title: string;
  detail: string;
}

interface Metrics {
  explanations: number;
  conceptsLearned: number;
  languages: number;
  streak: number;
}

function metrics(events: LocalEvent[], todayKey: string): Metrics {
  const concepts = new Set<string>();
  const languages = new Set<string>();
  for (const e of events) {
    if (e.outcome === 'understood' && e.concept) concepts.add(e.concept);
    if (e.language) languages.add(e.language);
  }
  return {
    explanations: events.length,
    conceptsLearned: concepts.size,
    languages: languages.size,
    streak: currentStreak(new Set(events.map(eventDay)), todayKey),
  };
}

/** Ordered so the most impressive newly-crossed milestone is last (callers can take the peak). */
const MILESTONE_DEFS: Array<{ id: MilestoneId; met: (m: Metrics) => boolean; title: string; detail: string }> = [
  { id: 'first_explanation', met: (m) => m.explanations >= 1, title: 'First explanation', detail: 'You understood your first piece of code.' },
  { id: 'streak_3', met: (m) => m.streak >= 3, title: 'Three-day streak', detail: 'Three days of learning in a row.' },
  { id: 'five_languages', met: (m) => m.languages >= 5, title: 'Five languages', detail: 'You’ve explored five programming languages.' },
  { id: 'ten_concepts', met: (m) => m.conceptsLearned >= 10, title: 'Ten concepts', detail: 'Ten concepts with a passed check.' },
  { id: 'streak_7', met: (m) => m.streak >= 7, title: 'Seven-day streak', detail: 'Your longest Unvibe streak yet.' },
  { id: 'hundred_explanations', met: (m) => m.explanations >= 100, title: 'One hundred explanations', detail: 'A hundred explanations completed. Real momentum.' },
];

/**
 * Milestones newly crossed going from `before` to `after` (i.e. met now, not met before).
 * Pure. Returns them in MILESTONE_DEFS order; the last element is the "peak" to celebrate.
 */
export function milestonesCrossed(before: LocalEvent[], after: LocalEvent[], todayKey: string): Milestone[] {
  const mb = metrics(before, todayKey);
  const ma = metrics(after, todayKey);
  return MILESTONE_DEFS.filter((d) => d.met(ma) && !d.met(mb)).map((d) => ({ id: d.id, title: d.title, detail: d.detail }));
}
