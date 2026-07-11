import type { EventRecord, IncomingEvent, ProfileSummary, ProjectSummary } from './types';

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function shiftKey(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(events: Array<{ ts: string }>, todayKey: string): number {
  const days = new Set(events.map((e) => dateKey(e.ts)));
  if (days.size === 0) {
    return 0;
  }
  const yesterday = shiftKey(todayKey, -1);
  let cursor: string;
  if (days.has(todayKey)) {
    cursor = todayKey;
  } else if (days.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftKey(cursor, -1);
  }
  return streak;
}

/** Latest outcome per concept determines its mastery state. */
export function computeProfile(events: IncomingEvent[]): ProfileSummary {
  const conceptLatest = new Map<string, { ts: string; outcome: string }>();
  for (const e of events) {
    if (e.concept) {
      const prev = conceptLatest.get(e.concept);
      if (!prev || e.ts > prev.ts) {
        conceptLatest.set(e.concept, { ts: e.ts, outcome: e.outcome });
      }
    }
  }
  const states = [...conceptLatest.values()];
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalReviews: events.length,
    understood: events.filter((e) => e.outcome === 'understood').length,
    needsReview: events.filter((e) => e.outcome === 'needs_review').length,
    conceptsSeen: states.length,
    conceptsUnderstood: states.filter((s) => s.outcome === 'understood').length,
    conceptsNeedReview: states.filter((s) => s.outcome === 'needs_review').length,
    currentStreakDays: computeStreak(events, today),
    lastActive: events.length ? events[events.length - 1].ts : undefined,
  };
}

export function computeProjects(events: EventRecord[]): ProjectSummary[] {
  const byProject = new Map<string, { reviews: number; lastActive: string }>();
  for (const e of events) {
    const name = e.project ?? deriveProject(e.file);
    const prev = byProject.get(name) ?? { reviews: 0, lastActive: e.ts };
    prev.reviews += 1;
    if (e.ts > prev.lastActive) {
      prev.lastActive = e.ts;
    }
    byProject.set(name, prev);
  }
  return [...byProject.entries()]
    .map(([name, v]) => ({ name, reviews: v.reviews, lastActive: v.lastActive }))
    .sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}

function deriveProject(file?: string): string {
  if (!file) {
    return 'Unknown';
  }
  const top = file.replace(/\\/g, '/').split('/')[0];
  return top || 'Unknown';
}
