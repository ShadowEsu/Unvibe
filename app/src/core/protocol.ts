/**
 * Wire contract with the Unvibe backend (web/src/ai/protocol.ts mirrors this).
 * Source of truth moved here from extension/src/protocol.ts at the desktop pivot;
 * adds the 5-level scale ('new' … 'expert').
 */

export type ReviewScope = 'selection' | 'file' | 'diff' | 'project';
export type ExplanationLevel = 'new' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

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
}

/** Server -> app streaming events (one JSON object per SSE `data:` line). */
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
