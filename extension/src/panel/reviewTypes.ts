export type ReviewScope = 'selection' | 'file' | 'diff' | 'project';
export type ExplanationLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * A request to review something. In Milestone 1 this carries the resolved context metadata
 * that the panel displays. Milestone 2 attaches the (secret-filtered) code context and
 * streams an explanation from the backend.
 */
export interface ReviewRequest {
  scope: ReviewScope;
  title: string;
  /** Human-readable description of what will be reviewed (e.g. "3 changed files"). */
  detail: string;
  files: string[];
  level: ExplanationLevel;
}

/** Messages sent host -> webview. */
export type HostToWebview =
  | { type: 'review'; request: ReviewRequest }
  | { type: 'level'; level: ExplanationLevel }
  | { type: 'clear' };

/** Messages sent webview -> host. */
export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'levelChanged'; level: ExplanationLevel }
  | { type: 'action'; action: 'understand' | 'explainDifferently' | 'testMe' }
  | { type: 'openDashboard' };
