/**
 * Explanation quota for the desktop app.
 * Signed-in: prefer server billing overview.
 * Sealed trial: server trial meter (per install).
 * Local / unsigned: Free allotment counted from local review events. Public-beta installs receive 50 actions for 30 days.
 */
import { billingOverview, trialUsageOverview, type BillingUsageLine } from './backend';
import { store } from './store';
import { fullProductBuildEnabled, trialBuildEnabled } from './trial';

export const LOCAL_FREE_LIMIT = 30;
/** Public beta: 50 AI explanations during the 30-day device trial. */
export const TRIAL_FREE_LIMIT = 50;
/** UI-safe representation of an unrestricted local entitlement. */
export const FULL_PRODUCT_LIMIT = 1_000_000;

export interface AppUsage {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  plan: 'free' | 'pro' | 'teams' | 'local' | 'trial' | 'full';
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
  const fullProduct = fullProductBuildEnabled();
  const trial = trialBuildEnabled() ? store().betaTrialWindow(now) : null;
  const trialUsed = trial
    ? store().events().filter((ev) => ev.eventType === 'explanation_completed' && ev.ts >= trial.startedAt).length
    : used;
  const limit = fullProduct ? FULL_PRODUCT_LIMIT : trial ? TRIAL_FREE_LIMIT : LOCAL_FREE_LIMIT;
  return {
    used: trialUsed,
    limit,
    remaining: fullProduct ? FULL_PRODUCT_LIMIT : trial?.expired ? 0 : Math.max(0, limit - trialUsed),
    resetsAt: trial?.expiresAt ?? resetsAt,
    plan: fullProduct ? 'full' : trialBuildEnabled() ? 'trial' : 'local',
    source: 'local',
  };
}

export async function resolveAppUsage(): Promise<AppUsage> {
  // A full-product build is intentionally local-first and never lets an
  // unavailable billing endpoint put the owner behind a feature gate.
  if (fullProductBuildEnabled()) return localExplanationUsage();
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

/** How long a usage snapshot stays fresh before the next explanation re-checks the server. */
const USAGE_TTL_MS = 60_000;
let usageSnapshot: { at: number; account: string; value: AppUsage } | null = null;
let usageInflight: Promise<AppUsage> | null = null;

/** Fetch usage now and remember it; concurrent callers share one request. */
export function refreshAppUsage(): Promise<AppUsage> {
  const account = store().token() ?? '';
  usageInflight ??= resolveAppUsage()
    .then((value) => {
      usageSnapshot = { at: Date.now(), account, value };
      return value;
    })
    .finally(() => {
      usageInflight = null;
    });
  return usageInflight;
}

/**
 * Usage for the pre-flight check before an explanation. Serves a recent snapshot so the
 * first token is not waiting on an extra network round trip. The server still enforces
 * limits, and an exhausted or stale snapshot is always re-checked.
 */
export function cachedAppUsage(now = Date.now()): Promise<AppUsage> {
  const account = store().token() ?? '';
  const snap = usageSnapshot;
  if (snap && snap.account === account && now - snap.at < USAGE_TTL_MS && snap.value.remaining > 0) {
    return Promise.resolve(snap.value);
  }
  return refreshAppUsage();
}

/** Drop the snapshot after sign-in, sign-out, or a plan change. */
export function invalidateAppUsage(): void {
  usageSnapshot = null;
}
