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
  if (phase === 'error') return errorCode === 'plan_limit_reached' || (outOfExplanations && !isNetworkError(errorCode));
  return outOfExplanations && (phase === 'boot' || phase === 'empty');
}

/** review.ts: the request never reached Unvibe's server, with (`unreachable`) or without (`offline`) a network. */
function isNetworkError(errorCode: string): boolean {
  return errorCode === 'offline' || errorCode === 'unreachable';
}

/**
 * The error card (Design A4, polish bar B-5): what happened and why in the title, what to do in the
 * body, one button that does it. A network failure says so and offers Retry; any other error keeps
 * the service's own message with Try again.
 */
export interface ErrorView {
  title: string;
  body: string;
  action: 'Retry' | 'Try again';
}

export function errorView(errorCode: string, message: string): ErrorView {
  if (errorCode === 'offline') {
    return { title: "You're offline. Unvibe can't reach its server.", body: 'Check your Wi-Fi or network, then retry.', action: 'Retry' };
  }
  if (errorCode === 'unreachable') {
    return { title: "Unvibe can't reach its server.", body: 'Your network is connected, so the server may be down for a moment. Retry in a bit.', action: 'Retry' };
  }
  return { title: "Couldn't explain that", body: message, action: 'Try again' };
}

/** The header's one status word (Design P10, sentence case), consistent with what the panel shows. */
export function statusLabel(phase: Phase, opts: { limited: boolean; errorCode: string; proGate: boolean }): string {
  if (opts.limited) return 'Paused';
  switch (phase) {
    case 'boot': return 'Capturing';
    case 'ready': return 'Reading';
    case 'aiConsent':
    case 'confirm': return 'Waiting for you';
    case 'empty': return 'Waiting';
    case 'consent': return 'Check needed';
    case 'blocked': return 'Blocked';
    case 'streaming': return 'Explaining';
    case 'done': return 'Ready';
    case 'error': return isNetworkError(opts.errorCode) ? 'Offline' : opts.proGate ? 'Pro feature' : 'Error';
  }
}

/** The status chip's style: one tone per kind of state, so Offline and Paused never show the "ready" dot. */
export function statusTone(phase: Phase, opts: { limited: boolean; errorCode: string }): string {
  if (opts.limited) return 'paused';
  if (phase === 'error') return isNetworkError(opts.errorCode) ? 'offline' : 'error';
  return phase;
}
