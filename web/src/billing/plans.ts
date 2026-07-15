export type PlanId = 'private_beta' | 'pro' | 'team' | 'professional';
export type BillingInterval = 'monthly' | 'annual';
export type PlanTier = 'free' | 'pro' | 'team';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tier: PlanTier;
  explanationLimit: number | null;
  monthlyUsdPerSeat?: number;
  annualUsdPerSeat?: number;
  teamPlan?: boolean;
  available: boolean;
}

/**
 * Source of truth for public price presentation and server-side quotas.
 * Learning history, saved material, comprehension checks, and teaching remain free;
 * this cap applies only to cloud-generated explanations.
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  private_beta: {
    id: 'private_beta',
    name: 'Free beta',
    tier: 'free',
    explanationLimit: 50,
    available: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    explanationLimit: 250,
    monthlyUsdPerSeat: 12,
    annualUsdPerSeat: 8,
    available: true,
  },
  team: {
    id: 'team',
    name: 'Team',
    tier: 'team',
    explanationLimit: 200,
    monthlyUsdPerSeat: 8,
    annualUsdPerSeat: 6,
    teamPlan: true,
    available: true,
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    tier: 'pro',
    explanationLimit: null,
    available: false,
  },
};

export interface UsageSummary {
  planId: PlanId;
  used: number;
  limit: number | null;
  remaining: number | null;
  periodStart: string;
}

export function planLimit(planId: PlanId): number | null {
  return PLANS[planId].explanationLimit;
}

export function planTier(planId: PlanId): PlanTier {
  return PLANS[planId].tier;
}
