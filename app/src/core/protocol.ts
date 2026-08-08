/**
 * Wire contract with the Unvibe backend (web/src/ai/protocol.ts mirrors this).
 * Source of truth moved here from extension/src/protocol.ts at the desktop pivot;
 * adds the 5-level scale ('new' … 'expert').
 */

export type ReviewScope = 'selection' | 'file' | 'diff' | 'project';
export type ExplanationLevel = 'new' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
/** The learning intent for a comprehension card. It affects the generated question, not the code sent. */
export type QuizMode = 'quick-check' | 'recall' | 'scenario';

export interface DiffHunk {
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface ReviewContext {
  language: string;
  primaryFile?: string;
  projectStructure: string[];
  imports: string[];
  code?: string;
  enclosing?: string;
  diffHunks?: DiffHunk[];
  selection?: { file: string; startLine: number; endLine: number };
  truncated?: boolean;
}

export interface ReviewRequestPayload {
  scope: ReviewScope;
  level: ExplanationLevel;
  context: ReviewContext;
  question?: string;
  variant?: 'default' | 'different';
  quizMode?: QuizMode;
}

/**
 * Server -> app streaming events (one JSON object per SSE `data:` line).
 * This is the WIRE format from the backend. The app also generates local
 * events (consent, blocked, status, question, graded) — those are defined
 * in WidgetEvent (review.ts) and are never part of the SSE stream.
 */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; model: string; mock: boolean }
  | { type: 'error'; message: string };

/** A single multiple-choice comprehension question (non-streaming). answerIndex/rationale
 * are held in the main process and never sent to the widget renderer until after grading. */
export interface ComprehensionQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  rationale: string;
  concept: string;
  conceptLabel: string;
}

/**
 * Trust-boundary guard for comprehension questions received from the backend. Grading compares
 * the picked index to answerIndex, so a malformed question (float or out-of-range answerIndex,
 * empty/duplicate options) would silently grade a correct pick as wrong and corrupt mastery
 * evidence. Reject anything that cannot be graded unambiguously.
 */
export function isValidComprehensionQuestion(value: unknown): value is ComprehensionQuestion {
  if (typeof value !== 'object' || value === null) return false;
  const q = value as Record<string, unknown>;
  if (typeof q.question !== 'string' || q.question.trim().length === 0) return false;
  if (!Array.isArray(q.options) || q.options.length < 2) return false;
  if (!q.options.every((o) => typeof o === 'string' && o.trim().length > 0)) return false;
  const distinct = new Set(q.options.map((o) => String(o).trim().toLocaleLowerCase('en-US')));
  if (distinct.size !== q.options.length) return false;
  if (typeof q.answerIndex !== 'number' || !Number.isInteger(q.answerIndex)) return false;
  if (q.answerIndex < 0 || q.answerIndex >= q.options.length) return false;
  return typeof q.rationale === 'string' && typeof q.concept === 'string' && typeof q.conceptLabel === 'string';
}
