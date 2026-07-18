import type {
  BillingInterval,
  PlanDefinition,
  PlanId,
  PlanLimits,
  SubscriptionStatus,
  UsageKind,
  WorkspaceRole,
} from './types';

const FREE_LIMITS: PlanLimits = {
  aiExplanations: 50,
  activeProjects: 1,
  dictionaryItems: 25,
  savedItems: 20,
  projectQuestions: 10,
};

const PRO_LIMITS: PlanLimits = {
  aiExplanations: 100,
  activeProjects: 10,
  dictionaryItems: 1_000,
  savedItems: 1_000,
  projectQuestions: 500,
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Learn how your code works — for trying Unvibe and smaller projects.',
    monthlyUnitAmount: 0,
    annualUnitAmount: 0,
    minimumSeats: 1,
    workspaceType: 'personal',
    limits: FREE_LIMITS,
    features: ['50 AI explanations/month', '1 active project', 'Core explanation levels', 'Selected-code explanations'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Understand the complete project around your selection.',
    monthlyUnitAmount: 800,
    annualUnitAmount: 7_200,
    minimumSeats: 1,
    workspaceType: 'personal',
    limits: PRO_LIMITS,
    features: [
      '100 AI explanations/month',
      'Git diff + agent change briefs',
      'Nearby-file context',
      'Since-last-understood compares',
      'Expert explanations',
    ],
  },
  teams: {
    id: 'teams',
    name: 'Teams',
    description: 'Shared understanding, permissions, and billing for a team.',
    monthlyUnitAmount: 800,
    annualUnitAmount: 7_200,
    minimumSeats: 2,
    workspaceType: 'team',
    limits: PRO_LIMITS,
    features: ['100 AI explanations/member/month', 'Shared workspaces', 'Owner and admin controls', 'All Pro understanding features'],
  },
};

/** New Teams checkouts are paused. Existing Teams subscriptions still enforce and sync. */
export const TEAMS_CHECKOUT_ENABLED = false;

export const BILLABLE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'trialing',
  'active',
  'grace_period',
]);

const LIMIT_KEY: Record<UsageKind, keyof PlanLimits> = {
  ai_explanation: 'aiExplanations',
  project_question: 'projectQuestions',
  indexed_project: 'activeProjects',
  dictionary_item: 'dictionaryItems',
  saved_item: 'savedItems',
};

export function planLimit(plan: PlanId, kind: UsageKind, seats = 1): number {
  const base = PLANS[plan].limits[LIMIT_KEY[kind]];
  return plan === 'teams' && (kind === 'ai_explanation' || kind === 'project_question') ? base * seats : base;
}

export function normalizedSeats(plan: PlanId, seats: number): number {
  if (!Number.isInteger(seats)) throw new Error('Seat quantity must be a whole number.');
  if (plan !== 'teams') return 1;
  if (seats < PLANS.teams.minimumSeats) throw new Error('Teams requires at least 2 seats.');
  if (seats > 500) throw new Error('Contact support for more than 500 seats.');
  return seats;
}

export function priceFor(plan: PlanId, interval: BillingInterval, seats: number): number {
  const quantity = normalizedSeats(plan, seats);
  const unit = interval === 'monthly' ? PLANS[plan].monthlyUnitAmount : PLANS[plan].annualUnitAmount;
  return unit * quantity;
}

export function annualSavingsPercent(plan: Exclude<PlanId, 'free'>): number {
  const monthlyAnnualized = PLANS[plan].monthlyUnitAmount * 12;
  return Math.round((1 - PLANS[plan].annualUnitAmount / monthlyAnnualized) * 100);
}

export function teamsAnnualSavingsPercent(): number {
  return annualSavingsPercent('teams');
}

export function proAnnualSavingsPercent(): number {
  return annualSavingsPercent('pro');
}

export function canManageBilling(role: WorkspaceRole): boolean {
  return role === 'owner';
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function effectivePlan(plan: PlanId, status: SubscriptionStatus, graceEndsAt?: string, now = new Date()): PlanId {
  if (plan === 'free') return 'free';
  if (!BILLABLE_STATUSES.has(status)) return 'free';
  if (status === 'grace_period' && (!graceEndsAt || new Date(graceEndsAt) <= now)) return 'free';
  return plan;
}

export function minimumSeatsForUsage(occupiedSeats: number, pendingInvitations: number): number {
  return Math.max(2, occupiedSeats + pendingInvitations);
}

export function monthWindow(now = new Date()): { startsAt: string; resetsAt: string } {
  const starts = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startsAt: starts.toISOString(), resetsAt: resets.toISOString() };
}
