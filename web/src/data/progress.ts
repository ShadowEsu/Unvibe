import type { EventRecord, IncomingEvent, ProfileSummary, ProjectSummary } from './types';

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function eventDate(event: Pick<IncomingEvent, 'ts' | 'localDate'>): string {
  return event.localDate ?? dateKey(event.ts);
}

function shiftKey(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(events: Array<Pick<IncomingEvent, 'ts' | 'localDate'>>, todayKey: string): number {
  const days = new Set(events.map(eventDate));
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

export function dateInTimezone(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Repeated successful checks provide cautious evidence; no state is called mastery. */
export function computeProfile(events: IncomingEvent[]): ProfileSummary {
  const conceptEvidence = new Map<string, IncomingEvent[]>();
  for (const e of events) {
    if (e.concept) {
      const evidence = conceptEvidence.get(e.concept) ?? [];
      evidence.push(e);
      conceptEvidence.set(e.concept, evidence);
    }
  }
  const states = [...conceptEvidence.values()].map((evidence) => {
    const chronological = [...evidence].sort((a, b) => a.ts.localeCompare(b.ts));
    const latest = chronological[chronological.length - 1];
    const correct = chronological.filter((event) => event.outcome === 'understood').length;
    return { latest: latest.outcome, correct };
  });
  const timezone = events.length ? events[events.length - 1].timezone ?? 'UTC' : 'UTC';
  const today = dateInTimezone(new Date(), timezone);
  return {
    totalReviews: events.length,
    understood: events.filter((e) => e.outcome === 'understood').length,
    needsReview: events.filter((e) => e.outcome === 'needs_review').length,
    conceptsSeen: states.length,
    conceptsUnderstood: states.filter((s) => s.correct > 0).length,
    conceptsFamiliar: states.filter((s) => s.correct >= 2 && s.correct < 3 && s.latest !== 'needs_review').length,
    conceptsStrong: states.filter((s) => s.correct >= 3 && s.latest !== 'needs_review').length,
    conceptsNeedReview: states.filter((s) => s.latest === 'needs_review').length,
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
