import type { LearningEvent } from '../learning/types';

const MAX_PENDING = 1000;

/**
 * Pure outbox operations. Events are keyed by id, so re-enqueuing an event (e.g. after its
 * outcome is upgraded) replaces the older copy rather than duplicating it.
 */
export function enqueue(pending: LearningEvent[], events: LearningEvent[]): LearningEvent[] {
  const byId = new Map(pending.map((e) => [e.id, e] as const));
  for (const e of events) {
    byId.set(e.id, e);
  }
  return [...byId.values()].slice(-MAX_PENDING);
}

export function removeIds(pending: LearningEvent[], ids: string[]): LearningEvent[] {
  const set = new Set(ids);
  return pending.filter((e) => !set.has(e.id));
}
