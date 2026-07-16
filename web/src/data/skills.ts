import { createHash } from 'node:crypto';
import type { EventRecord, SkillEvidenceState, SkillRecord } from './types';

function normalizedConcept(event: EventRecord): string | undefined {
  const name = (event.conceptLabel ?? event.concept)?.trim().replace(/\s+/g, ' ');
  return name ? name.toLocaleLowerCase('en-US') : undefined;
}

function evidenceState(successful: number, latestOutcome: EventRecord['outcome']): SkillEvidenceState {
  if (latestOutcome === 'needs_review') return 'needs_review';
  if (successful >= 3) return 'strong';
  if (successful >= 2) return 'familiar';
  return 'seen';
}

function stableSkillId(userId: string, normalizedName: string): string {
  return createHash('sha256').update(`${userId}\0${normalizedName}`).digest('hex').slice(0, 32);
}

export function computeSkills(userId: string, events: EventRecord[]): SkillRecord[] {
  const groups = new Map<string, EventRecord[]>();
  for (const event of events) {
    const key = normalizedConcept(event);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([normalizedName, group]) => {
    const ordered = [...group].sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id));
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const successful = ordered.filter((event) => event.outcome === 'understood').length;
    const unsuccessful = ordered.filter((event) => event.outcome === 'needs_review').length;
    const state = evidenceState(successful, last.outcome);
    const nextReviewDate = state === 'strong' ? undefined : last.localDate ?? last.ts.slice(0, 10);
    return {
      id: stableSkillId(userId, normalizedName),
      userId,
      normalizedName,
      displayName: last.conceptLabel?.trim() || last.concept?.trim() || normalizedName,
      category: last.language || undefined,
      language: last.language || undefined,
      firstEncounteredAt: first.ts,
      lastEncounteredAt: last.ts,
      lastReviewedAt: last.ts,
      encounterCount: ordered.length,
      reviewCount: ordered.length,
      successfulChecks: successful,
      unsuccessfulChecks: unsuccessful,
      evidenceState: state,
      nextReviewDate,
      relatedProjects: [...new Set(ordered.flatMap((event) => event.project ? [event.project] : []))],
      relatedEventIds: ordered.map((event) => event.id),
    };
  }).sort((a, b) => b.lastEncounteredAt.localeCompare(a.lastEncounteredAt) || a.normalizedName.localeCompare(b.normalizedName));
}
