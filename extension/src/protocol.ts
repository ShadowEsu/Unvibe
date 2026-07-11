/**
 * Wire contract between the extension and the Uncode AI service.
 * This is the source of truth; the server mirrors these shapes in server/src/protocol.ts.
 */

export type ReviewScope = 'selection' | 'file' | 'diff' | 'project';
export type ExplanationLevel = 'beginner' | 'intermediate' | 'advanced';

export interface DiffHunk {
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Raw unified-diff lines, each prefixed with '+', '-', or ' '. */
  lines: string[];
}

export interface ReviewContext {
  language: string;
  primaryFile?: string;
  /** Shallow top-level project structure (names only), for architectural grounding. */
  projectStructure: string[];
  imports: string[];
  /** Selected or full-file code (may be truncated). */
  code?: string;
  /** Lines surrounding a selection, for local context. */
  enclosing?: string;
  diffHunks?: DiffHunk[];
  selection?: { file: string; startLine: number; endLine: number };
  truncated?: boolean;
}

export interface ReviewRequestPayload {
  scope: ReviewScope;
  level: ExplanationLevel;
  context: ReviewContext;
  /** Optional follow-up question in the same review thread. */
  question?: string;
  /** 'different' asks for a materially different explanation of the same code. */
  variant?: 'default' | 'different';
}

/** Server -> extension streaming events (one JSON object per SSE `data:` line). */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; model: string; mock: boolean }
  | { type: 'error'; message: string };

/** A single multiple-choice comprehension question (non-streaming response). */
export interface ComprehensionQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  rationale: string;
  concept: string;
  conceptLabel: string;
}
