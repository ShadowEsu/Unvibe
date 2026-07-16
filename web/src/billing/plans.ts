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
  aiExplanations: 30,
  activeProjects: 1,
  dictionaryItems: 25,
  savedItems: 20,
  projectQuestions: 10,
};

const PRO_LIMITS: PlanLimits = {
  aiExplanations: 1_000,
  activeProjects: 10,
  dictionaryItems: 1_000,
  savedItems: 1_000,
  projectQuestions: 500,
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'A real daily learning loop for individual coders.',
    monthlyUnitAmount: 0,
    annualUnitAmount: 0,
    minimumSeats: 1,
    workspaceType: 'personal',
    limits: FREE_LIMITS,
    features: ['30 AI explanations/month', '1 active project', '25 dictionary items', '20 saved items'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'More room for one coder working across projects.',
    monthlyUnitAmount: 800,
    annualUnitAmount: 9_600,
    minimumSeats: 1,
    workspaceType: 'personal',
    limits: PRO_LIMITS,
    features: ['1,000 AI explanations/month', 'Up to 10 active projects', 'Expanded learning library'],
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
    features: ['1,000 AI explanations/member/month', 'Shared workspaces', 'Owner and admin controls'],
  },
};

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

export function teamsAnnualSavingsPercent(): number {
  const monthlyAnnualized = PLANS.teams.monthlyUnitAmount * 12;
  return Math.round((1 - PLANS.teams.annualUnitAmount / monthlyAnnualized) * 100);
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
