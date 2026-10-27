import { FAIR_USE_URL, asPlanId, formatCount } from '../../core/plans';
import { refillDate, SIGN_IN_FREE_LINE } from './planStatus';

export const BETA_SURVEY_URL = 'https://unvibe.site/feedback';

export interface LimitOfferCopy {
  title: string;
  body: string;
  primary: string;
  primaryKind: 'survey' | 'plan';
  showPlan: boolean;
}

/**
 * While Pro is closed nothing can be bought, so a used-up Free allowance says when it comes back
 * (`resetsAt` as a date). The public-beta trial never refills; it points to signing in instead.
 */
function refillSentence(plan: string | undefined, usage: { limit: number; resetsAt: string }): string {
  const refill = refillDate(plan, usage.resetsAt);
  if (refill) return `Your ${formatCount(usage.limit)} Free explanations refill on ${refill}.`;
  if (plan === 'trial') return `The free explanations on this computer don't refill. ${SIGN_IN_FREE_LINE}`;
  return '';
}

/**
 * `limit: null` is an unlimited allowance (Big Business): it has no monthly cap and never reaches a
 * limit, so its copy is only the fair-use rate limit against automated abuse, never a monthly
 * number or an upgrade.
 */
export function limitOfferCopy(plan: string | undefined, usage: {
  used: number;
  limit: number | null;
  resetsAt: string;
}, proOpen: boolean): LimitOfferCopy {
  const id = asPlanId(plan);
  if (id === 'business' || usage.limit === null) {
    return {
      title: 'Paused for a moment',
      body: `${id === 'business' ? 'Big Business explanations are unlimited for up to 10 named seats. ' : ''}The fair-use rate limit against automated abuse paused them for a moment. Try again in a few minutes. The written limit is at ${FAIR_USE_URL}.`,
      primary: 'Open Plan',
      primaryKind: 'plan',
      showPlan: false,
    };
  }
  const reset = new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const refill = proOpen ? '' : refillSentence(plan, { limit: usage.limit, resetsAt: usage.resetsAt });
  if (id === 'trial' || id === 'local' || id === 'free') {
    return {
      title: 'Session paused',
      // No reward and no upgrade promise: nothing grants Pro for the survey, and Plan itself says
      // whether payments are open.
      body: `${refill ? `${refill} ` : ''}Tell us how Unvibe is working for you in a short survey.`,
      primary: 'Open the survey',
      primaryKind: 'survey',
      showPlan: true,
    };
  }
  // Enterprise and a plan this build doesn't know are paid plans too: never Free copy, never an upgrade.
  if (id === 'pro' || id === 'teams' || id === 'enterprise' || id === 'paid') {
    return {
      title: 'Monthly limit reached',
      body: `You used ${formatCount(usage.used)} of ${formatCount(usage.limit)} explanations. They refill on ${reset}. Open Plan & usage for details.`,
      primary: 'Open Plan',
      primaryKind: 'plan',
      showPlan: false,
    };
  }
  return {
    title: 'Monthly limit reached',
    body: `You used all ${formatCount(usage.limit)} Free explanations this month.${proOpen ? ' Open Plan to upgrade.' : refill ? ` ${refill}` : ''}`,
    primary: 'Open Plan',
    primaryKind: 'plan',
    showPlan: true,
  };
}
