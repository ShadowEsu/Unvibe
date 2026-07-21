/**
 * Explanation quota for the desktop app.
 * Signed-in: prefer server billing overview.
 * Sealed trial: server trial meter (per install).
 * Local / unsigned: Free allotment (50/month) counted from local review events.
 */
import { billingOverview, trialUsageOverview, type BillingUsageLine } from './backend';
import { store } from './store';
import { trialBuildEnabled } from './trial';

export const LOCAL_FREE_LIMIT = 50;
export const TRIAL_FREE_LIMIT = 15;

export interface AppUsage {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  plan: 'free' | 'pro' | 'teams' | 'local' | 'trial';
  source: 'cloud' | 'local' | 'trial';
}

function monthWindow(now = new Date()): { startsAt: string; resetsAt: string; prefix: string } {
  const starts = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const prefix = starts.toISOString().slice(0, 7); // YYYY-MM
  return { startsAt: starts.toISOString(), resetsAt: resets.toISOString(), prefix };
}

export function localExplanationUsage(now = new Date()): AppUsage {
  const { resetsAt, prefix } = monthWindow(now);
  const used = store().events().filter((ev) => {
    if (ev.eventType && ev.eventType !== 'explanation_completed') return false;
    return ev.ts.slice(0, 7) === prefix;
  }).length;
  const limit = trialBuildEnabled() ? TRIAL_FREE_LIMIT : LOCAL_FREE_LIMIT;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt,
    plan: trialBuildEnabled() ? 'trial' : 'local',
    source: 'local',
  };
}

export async function resolveAppUsage(): Promise<AppUsage> {
  const token = store().token();
  if (token) {
    try {
      const { overview } = await billingOverview(token);
      const line = overview.usage.find((item: BillingUsageLine) => item.kind === 'ai_explanation');
      if (line) {
        return {
          used: line.used,
          limit: line.limit,
          remaining: line.remaining,
          resetsAt: line.resetsAt,
          plan: overview.subscription.plan,
          source: 'cloud',
        };
      }
    } catch {
      /* fall through */
    }
  }
  if (!token && trialBuildEnabled()) {
    try {
      const overview = await trialUsageOverview();
      const line = overview?.usage.find((item) => item.kind === 'ai_explanation');
      if (line) {
        return {
          used: line.used,
          limit: line.limit,
          remaining: line.remaining,
          resetsAt: line.resetsAt,
          plan: 'trial',
          source: 'trial',
        };
      }
    } catch {
      /* fall through to local */
    }
  }
  return localExplanationUsage();
}
