import { FAIR_USE_URL, asPlanId } from '../../core/plans';
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
  if (refill) return `Your ${usage.limit} Free explanations refill on ${refill}.`;
  if (plan === 'trial') return `The free explanations on this computer don't refill. ${SIGN_IN_FREE_LINE}`;
  return '';
}

export function limitOfferCopy(plan: string | undefined, usage: {
  used: number;
  limit: number;
  resetsAt: string;
}, proOpen: boolean): LimitOfferCopy {
  const reset = new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const refill = proOpen ? '' : refillSentence(plan, usage);
  const id = asPlanId(plan);
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
  if (id === 'business') {
    return {
      title: 'Fair-use limit reached',
      body: `You used ${usage.used} of ${usage.limit} explanations, the Big Business fair-use limit for this month. Explanations pause until ${reset}, and we contact you first. The written limit is at ${FAIR_USE_URL}.`,
      primary: 'Open Plan',
      primaryKind: 'plan',
      showPlan: false,
    };
  }
  // Enterprise and a plan this build doesn't know are paid plans too: never Free copy, never an upgrade.
  if (id === 'pro' || id === 'teams' || id === 'enterprise' || id === 'paid') {
    return {
      title: 'Monthly limit reached',
      body: `You used ${usage.used} of ${usage.limit} explanations. They refill on ${reset}. Open Plan to manage billing.`,
      primary: 'Open Plan',
      primaryKind: 'plan',
      showPlan: false,
    };
  }
  return {
    title: 'Monthly limit reached',
    body: `You used all ${usage.limit} Free explanations this month.${proOpen ? ' Open Plan to upgrade.' : refill ? ` ${refill}` : ''}`,
    primary: 'Open Plan',
    primaryKind: 'plan',
    showPlan: true,
  };
}
