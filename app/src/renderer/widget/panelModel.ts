import { refillDate } from '../shared/planStatus';

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

/** The allowance the last usage event reported. */
export interface LimitUsage {
  plan?: string;
  limit: number;
  resetsAt: string;
}

/**
 * A used-up allowance (Design A3, polish bar B-5): what happened in the title, when it comes back
 * (or when the public-beta trial's 30 days end, since that allowance never refills), and the one fix,
 * Use my own key (Settings › AI: with a key the app explains through your provider, see review.ts).
 * `links` are the quieter text links under that button.
 */
export interface LimitState {
  title: string;
  when: string;
  links: Array<'survey' | 'plan'>;
}

export function limitState(usage: LimitUsage, proOpen: boolean): LimitState {
  const { plan, limit } = usage;
  if (plan === 'trial') {
    const end = new Date(usage.resetsAt);
    const endDay = Number.isNaN(end.getTime()) ? '' : end.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    return {
      title: `You've used your 30-day allowance of ${limit} free explanations.`,
      when: `${endDay ? `It doesn't refill, and your 30 days end on ${endDay}.` : "It doesn't refill."} Sign in to keep going on the Free plan, which refills every month.`,
      links: proOpen ? ['survey', 'plan'] : ['survey'],
    };
  }
  const refill = refillDate(plan, usage.resetsAt);
  const when = refill ? `They refill on ${refill}.` : '';
  if (plan === 'pro' || plan === 'teams') {
    return { title: `You've used this month's ${limit} ${plan === 'pro' ? 'Pro' : 'Teams'} explanations.`, when, links: ['plan'] };
  }
  return { title: `You've used this month's ${limit} free explanations.`, when, links: proOpen ? ['survey', 'plan'] : ['survey'] };
}

/**
 * Whether the panel shows the limit state in place of its content. Main reports a used-up allowance
 * as a `plan_limit_reached` error; a panel opened with nothing to explain while the count is at zero
 * shows it too. A finished or streaming explanation stays on screen with the limit under it.
 */
export function showsLimit(phase: Phase, errorCode: string, outOfExplanations: boolean): boolean {
  if (phase === 'error') return errorCode === 'plan_limit_reached' || outOfExplanations;
  return outOfExplanations && (phase === 'boot' || phase === 'empty');
}
