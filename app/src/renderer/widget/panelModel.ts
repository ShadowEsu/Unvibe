/**
 * The review panel's state model, kept apart from widget.tsx (which renders on import) so the rules
 * for what the panel shows in each state are testable.
 */

/**
 * `aiConsent`: the first-send agreement (sending code to the provider, Terms, 18+);
 * `confirm`: a link started this review, Explain sends it; `consent`: a secret was found.
 */
export type Phase = 'boot' | 'ready' | 'aiConsent' | 'confirm' | 'empty' | 'consent' | 'blocked' | 'streaming' | 'done' | 'error';

/**
 * The action row under the explanation (Design A2, polish bar B-8). Streaming, done, Test me and
 * error all show the same three buttons in the same places, and one right-hand slot whose content
 * changes without moving them.
 */
export interface ActionRow {
  /** Understand, Explain differently, Test me and the follow-up box: only once the explanation has finished typing out. */
  ready: boolean;
  /** Stop generating while words arrive, then the saved note (or the mock AI note); nothing on an error. */
  right: 'stop' | 'saved' | 'mock' | 'none';
}

/** Null where the panel has no explanation frame (capture, agreement, picker, secret check). */
export function actionRow(phase: Phase, stillTyping: boolean, mock: boolean): ActionRow | null {
  if (phase !== 'streaming' && phase !== 'done' && phase !== 'error') return null;
  return {
    ready: phase === 'done' && !stillTyping,
    right: phase === 'streaming' ? 'stop' : phase === 'done' ? (mock ? 'mock' : 'saved') : 'none',
  };
}
