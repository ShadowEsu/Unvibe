import type {
  ConceptStatus,
  LearningEvent,
  LearningState,
  Outcome,
  Progress,
} from './types';

const MAX_EVENTS = 500;

export function emptyState(): LearningState {
  return { events: [], concepts: {} };
}

/** Local date key (YYYY-MM-DD) for an ISO timestamp. */
export function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Record a new review event (outcome defaults to 'reviewed'). Concepts unchanged here. */
export function addEvent(state: LearningState, event: LearningEvent): LearningState {
  return {
    events: [...state.events, event].slice(-MAX_EVENTS),
    concepts: state.concepts,
  };
}

/** Upgrade an event's outcome and update concept mastery accordingly. */
export function setOutcome(
  state: LearningState,
  id: string,
  outcome: Outcome,
  concept?: string,
  conceptLabel?: string,
): LearningState {
  const events = state.events.map((e) =>
    e.id === id ? { ...e, outcome, concept: concept ?? e.concept } : e,
  );

  const concepts = { ...state.concepts };
  if (concept) {
    const prev = concepts[concept];
    let next: ConceptStatus = prev?.state ?? 'seen';
    if (outcome === 'understood') {
      next = 'understood';
    } else if (outcome === 'needs_review') {
      next = 'needs_review';
    }
    concepts[concept] = {
      concept,
      label: conceptLabel ?? prev?.label ?? concept,
      state: next,
      updated: new Date().toISOString(),
    };
  }

  return { events, concepts };
}

/** Consecutive active days ending today or yesterday. */
export function computeStreak(events: LearningEvent[], todayKey: string): number {
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

function shiftKey(key: string, deltaDays: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function summarize(state: LearningState, todayKey: string): Progress {
  const concepts = Object.values(state.concepts);
  return {
    totalReviews: state.events.length,
    understood: state.events.filter((e) => e.outcome === 'understood').length,
    needsReview: state.events.filter((e) => e.outcome === 'needs_review').length,
    conceptsSeen: concepts.length,
    conceptsUnderstood: concepts.filter((c) => c.state === 'understood').length,
    conceptsNeedReview: concepts.filter((c) => c.state === 'needs_review').length,
    currentStreakDays: computeStreak(state.events, todayKey),
    lastActive: state.events.length ? state.events[state.events.length - 1].ts : undefined,
  };
}
