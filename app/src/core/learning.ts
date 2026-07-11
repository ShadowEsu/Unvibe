/**
 * Pure local learning model — records of what the user reviewed and understood, and the
 * derived stats the companion app shows. No I/O here; the main-process store persists these
 * and the backend mirrors them when signed in. Unit tested.
 */

export type Outcome = 'reviewed' | 'understood' | 'needs_review';

export interface LocalEvent {
  id: string;
  ts: string; // ISO
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
  conceptsMastered: number;
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

export const HEAT_DAYS = 182;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
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
  const days = new Set(events.map((e) => dayKey(e.ts)));

  const conceptLatest = new Map<string, string>();
  for (const e of events) {
    if (e.concept) conceptLatest.set(e.concept, e.outcome); // events assumed chronological
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
  for (const e of events) perDay.set(dayKey(e.ts), (perDay.get(dayKey(e.ts)) ?? 0) + 1);
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
    conceptsSeen: conceptLatest.size,
    conceptsMastered: [...conceptLatest.values()].filter((o) => o === 'understood').length,
    streak: currentStreak(days, todayKey),
    bestStreak: bestStreak(days),
    usage,
    heat,
    lastActive: events.length ? events[events.length - 1].ts : undefined,
  };
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  reviewed: 'Reviewed',
  understood: 'Understood',
  needs_review: 'To revisit',
};

export function computeFeed(events: LocalEvent[], limit: number): FeedItem[] {
  return [...events]
    .reverse()
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      ts: e.ts,
      title: e.conceptLabel ?? `${e.lines} lines of ${e.language ?? 'code'}`,
      meta: [e.sourceApp, OUTCOME_LABEL[e.outcome]].filter(Boolean).join(' · '),
      outcome: e.outcome,
    }));
}
