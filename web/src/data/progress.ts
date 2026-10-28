import type { EventRecord, IncomingEvent, ProfileSummary, ProjectSummary } from './types';

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
  return {
    totalReviews: events.length,
    understood: events.filter((e) => e.outcome === 'understood').length,
    needsReview: events.filter((e) => e.outcome === 'needs_review').length,
    conceptsSeen: states.length,
    conceptsUnderstood: states.filter((s) => s.correct > 0).length,
    conceptsFamiliar: states.filter((s) => s.correct >= 2 && s.correct < 3 && s.latest !== 'needs_review').length,
    conceptsStrong: states.filter((s) => s.correct >= 3 && s.latest !== 'needs_review').length,
    conceptsNeedReview: states.filter((s) => s.latest === 'needs_review').length,
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
