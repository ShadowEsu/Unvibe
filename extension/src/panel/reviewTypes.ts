import type { ReviewScope, ExplanationLevel } from '../protocol';
import type { SecretFinding } from '../security/secretFilter';
import type { Segment } from '../citations/citations';
import type { Progress } from '../learning/types';

export type { ReviewScope, ExplanationLevel } from '../protocol';

/**
 * A request to review something, as understood by the UI. Carries the resolved metadata the
 * panel displays; the (secret-filtered) code context is built separately by the controller.
 */
export interface ReviewRequest {
  scope: ReviewScope;
  title: string;
  detail: string;
  files: string[];
  level: ExplanationLevel;
}

/** Messages host -> webview. */
export type HostToWebview =
  | { type: 'review'; request: ReviewRequest }
  | { type: 'level'; level: ExplanationLevel }
  | { type: 'preview'; text: string; suspects: SecretFinding[] }
  | { type: 'blocked'; findings: SecretFinding[] }
  | { type: 'streamStart' }
  | { type: 'token'; text: string }
  | { type: 'rendered'; segments: Segment[]; unverified: number }
  | { type: 'streamDone'; mock: boolean }
  | { type: 'streamError'; message: string }
  | { type: 'comprehensionLoading' }
  | { type: 'comprehension'; question: string; options: string[] }
  | { type: 'comprehensionResult'; pass: boolean; rationale: string }
  | { type: 'stats'; progress: Progress }
  | { type: 'offline' }
  | { type: 'clear' };

/** Messages webview -> host. */
export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'levelChanged'; level: ExplanationLevel }
  | { type: 'consent'; granted: boolean }
  | { type: 'action'; action: 'understand' | 'explainDifferently' | 'testMe' }
  | { type: 'question'; text: string }
  | { type: 'comprehensionAnswer'; selectedIndex: number }
  | { type: 'openCitation'; file: string; startLine: number }
  | { type: 'retry' }
  | { type: 'openDashboard' };
