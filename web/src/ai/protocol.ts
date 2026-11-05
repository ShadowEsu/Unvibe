/**
 * Wire contract: mirror of app/src/core/protocol.ts (source of truth). Kept in sync by hand
 * during MVP; a shared package is a post-MVP cleanup.
 */

export type ReviewScope = 'selection' | 'file' | 'diff' | 'project';
export type ExplanationLevel = 'new' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
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
  /**
   * 'short' (the app's default since 2 Nov): 2 to 4 plain sentences on what a selection does.
   * 'full', or absent (apps before then): today's full-depth explanation.
   */
  detail?: 'short' | 'full';
  /** With detail 'full' after a short answer ("More detail"): that answer, so the detail goes on from it without repeating it. */
  shortAnswer?: string;
  quizMode?: QuizMode;
  /** Optional OpenRouter free-chat model id. Ignored unless the backend key is OpenRouter. */
  model?: string;
}

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; model: string; mock: boolean }
  | { type: 'error'; message: string };
