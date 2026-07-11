import type { ReviewScope, ExplanationLevel } from '../protocol';

export type Outcome = 'reviewed' | 'understood' | 'needs_review';
export type ConceptStatus = 'seen' | 'understood' | 'needs_review';

/** One review the user performed. Outcome starts 'reviewed' and is upgraded by the user. */
export interface LearningEvent {
  id: string;
  ts: string; // ISO timestamp
  scope: ReviewScope;
  level: ExplanationLevel;
  file?: string;
  outcome: Outcome;
  concept?: string; // kebab-case slug, set when a comprehension check assigns one
}

export interface ConceptState {
  concept: string;
  label: string;
  state: ConceptStatus;
  updated: string;
}

export interface LearningState {
  events: LearningEvent[];
  concepts: Record<string, ConceptState>;
}

export interface Progress {
  totalReviews: number;
  understood: number;
  needsReview: number;
  conceptsSeen: number;
  conceptsUnderstood: number;
  conceptsNeedReview: number;
  currentStreakDays: number;
  lastActive?: string;
}
