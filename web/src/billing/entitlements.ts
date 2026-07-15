import { planTier, type PlanId, type PlanTier } from './plans';

/**
 * Single entitlement catalogue. Product surfaces may render this metadata, but the backend is
 * the authority. New paid capabilities must be registered here before they can ship.
 */
export type FeatureId =
  | 'command_u_explanations'
  | 'explanation_depth'
  | 'snippets'
  | 'dictionary'
  | 'study'
  | 'projects'
  | 'progress'
  | 'notebook'
  | 'streaks'
  | 'auto_review'
  | 'auto_learning'
  | 'repository_intelligence'
  | 'architecture_mode'
  | 'daily_briefings'
  | 'ai_comparison'
  | 'knowledge_base'
  | 'local_ai'
  | 'ai_mentor'
  | 'team_workspace';

export interface FeatureDefinition {
  id: FeatureId;
  requiredPlan: PlanTier;
  /** A server-side feature flag name. False means the product must label the capability unavailable. */
  flag: string;
  backendRequirement: 'none' | 'sync' | 'ai' | 'repository-index' | 'team-service';
  localAvailability: boolean;
  beta: boolean;
  usageLimit?: 'cloud_explanations';
}

const free = (id: FeatureId, backendRequirement: FeatureDefinition['backendRequirement'] = 'none'): FeatureDefinition => ({
  id, requiredPlan: 'free', flag: `feature_${id}`, backendRequirement, localAvailability: true, beta: false,
});
const pro = (id: FeatureId, backendRequirement: FeatureDefinition['backendRequirement']): FeatureDefinition => ({
  id, requiredPlan: 'pro', flag: `feature_${id}`, backendRequirement, localAvailability: false, beta: true,
});

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  command_u_explanations: { ...free('command_u_explanations', 'ai'), usageLimit: 'cloud_explanations' },
  explanation_depth: free('explanation_depth', 'ai'),
  snippets: free('snippets', 'sync'),
  dictionary: free('dictionary'),
  study: free('study'),
  projects: free('projects', 'sync'),
  progress: free('progress', 'sync'),
  notebook: free('notebook', 'sync'),
  streaks: free('streaks', 'sync'),
  auto_review: pro('auto_review', 'repository-index'),
  auto_learning: pro('auto_learning', 'ai'),
  repository_intelligence: pro('repository_intelligence', 'repository-index'),
  architecture_mode: pro('architecture_mode', 'repository-index'),
  daily_briefings: pro('daily_briefings', 'ai'),
  ai_comparison: pro('ai_comparison', 'ai'),
  knowledge_base: pro('knowledge_base', 'sync'),
  local_ai: pro('local_ai', 'ai'),
  ai_mentor: pro('ai_mentor', 'ai'),
  team_workspace: { id: 'team_workspace', requiredPlan: 'team', flag: 'feature_team_workspace', backendRequirement: 'team-service', localAvailability: false, beta: true },
};

const tierRank: Record<PlanTier, number> = { free: 0, pro: 1, team: 2 };

export interface FeatureAccess {
  allowed: boolean;
  reason?: 'plan' | 'feature_flag';
  definition: FeatureDefinition;
}

/** Feature flags are server-owned. Unregistered flags default to disabled for beta capabilities. */
export function featureAccess(planId: PlanId, featureId: FeatureId, flags: Readonly<Record<string, boolean>> = {}): FeatureAccess {
  const definition = FEATURES[featureId];
  if (tierRank[planTier(planId)] < tierRank[definition.requiredPlan]) {
    return { allowed: false, reason: 'plan', definition };
  }
  if (definition.beta && flags[definition.flag] !== true) {
    return { allowed: false, reason: 'feature_flag', definition };
  }
  return { allowed: true, definition };
}
