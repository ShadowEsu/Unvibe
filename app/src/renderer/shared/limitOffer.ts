export const BETA_SURVEY_URL = 'https://unvibe.site/feedback';

export interface LimitOfferCopy {
  title: string;
  body: string;
  primary: string;
  primaryKind: 'survey' | 'plan';
  showPlan: boolean;
}

export function limitOfferCopy(plan: string | undefined, usage: {
  used: number;
  limit: number;
  resetsAt: string;
}): LimitOfferCopy {
  const reset = new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  if (plan === 'trial' || plan === 'local' || plan === 'free' || !plan) {
    return {
      title: 'Session paused',
      body: 'Finish the survey for 1 week of Pro, free. Or buy a subscription on Plan for more explanations.',
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
    body: `You used all ${usage.limit} Free explanations this month. Open Plan to upgrade to Pro.`,
    primary: 'Open Plan',
    primaryKind: 'plan',
    showPlan: true,
  };
}
