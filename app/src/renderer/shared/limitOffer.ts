import { refillDate } from './planStatus';

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
 * (`resetsAt` as a date). The public-beta trial never refills; it points to the Free plan instead.
 */
function refillSentence(plan: string | undefined, usage: { limit: number; resetsAt: string }): string {
  const refill = refillDate(plan, usage.resetsAt);
  if (refill) return `Your ${usage.limit} Free explanations refill on ${refill}.`;
  if (plan === 'trial') return 'The free explanations on this computer don\'t refill. Sign in to keep going on the Free plan, which refills every month.';
  return '';
}

export function limitOfferCopy(plan: string | undefined, usage: {
  used: number;
  limit: number;
  resetsAt: string;
}, proOpen: boolean): LimitOfferCopy {
  const reset = new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const refill = proOpen ? '' : refillSentence(plan, usage);
  if (plan === 'trial' || plan === 'local' || plan === 'free' || !plan) {
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
  if (plan === 'pro' || plan === 'teams') {
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
