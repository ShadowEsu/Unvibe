/**
 * Wire contract — mirror of extension/src/protocol.ts (source of truth). Kept in sync by hand
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
  quizMode?: QuizMode;
}

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; model: string; mock: boolean }
  | { type: 'error'; message: string };
