import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dayKey, lastNDates } from "@/lib/siteStatsStore";
import { isProbeWaitlistEmail } from "@/lib/waitlistProbes";

export interface PublicWaitlistSummary {
  total: number;
  attributed: number;
  referred: number;
  sourceCounts: Array<{ source: string; signups: number }>;
  campaignCounts: Array<{ source: string; medium: string; campaign: string; signups: number }>;
  dailySignups: Array<{ date: string; signups: number }>;
  timezone: "America/Los_Angeles";
}

interface WaitlistAnalyticsRow {
  email?: string | null;
  referred_by: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
}

let cachedClient: SupabaseClient | null = null;

function client(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  cachedClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cachedClient;
}

function safeTag(value: string | null, fallback: string): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return fallback;
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : "other-tagged";
}

function emptyWaitlistSummary(): PublicWaitlistSummary {
  return {
    total: 0,
    attributed: 0,
    referred: 0,
    sourceCounts: [],
    campaignCounts: [],
    dailySignups: lastNDates(14).map((date) => ({ date, signups: 0 })),
    timezone: "America/Los_Angeles",
  };
}

function summarizeWaitlist(rows: WaitlistAnalyticsRow[]): PublicWaitlistSummary {
  const sourceCounts = new Map<string, number>();
  const campaignCounts = new Map<string, { source: string; medium: string; campaign: string; signups: number }>();
  const dailyCounts = new Map<string, number>();
  let attributed = 0;
  let referred = 0;

  for (const row of rows) {
    const source = safeTag(row.utm_source, "direct");
    const medium = safeTag(row.utm_medium, "(not set)");
    const campaign = safeTag(row.utm_campaign, "(not set)");
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    if (source !== "direct") attributed += 1;
    if (row.referred_by?.trim()) referred += 1;

    const campaignKey = `${source}\u0000${medium}\u0000${campaign}`;
    const existingCampaign = campaignCounts.get(campaignKey);
    if (existingCampaign) existingCampaign.signups += 1;
    else campaignCounts.set(campaignKey, { source, medium, campaign, signups: 1 });

    const createdAt = new Date(row.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      const date = dayKey(createdAt);
      dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
    }
  }

  return {
    total: rows.length,
    attributed,
    referred,
    sourceCounts: Array.from(sourceCounts, ([source, signups]) => ({ source, signups }))
      .sort((a, b) => b.signups - a.signups || a.source.localeCompare(b.source))
      .slice(0, 12),
    campaignCounts: Array.from(campaignCounts.values())
      .sort((a, b) => b.signups - a.signups || a.source.localeCompare(b.source))
      .slice(0, 12),
    dailySignups: lastNDates(14).map((date) => ({ date, signups: dailyCounts.get(date) ?? 0 })),
    timezone: "America/Los_Angeles",
  };
}

/** Aggregate-only analytics. No names, emails, notes, or referral codes leave this module. */
export async function getPublicAnalytics(): Promise<{
  waitlist: PublicWaitlistSummary;
  betaDownloads: number;
}> {
  const supabase = client();
  if (!supabase) return { waitlist: emptyWaitlistSummary(), betaDownloads: 0 };

  const [waitlistResult, betaResult] = await Promise.all([
    supabase
      .from("waitlist_entries")
      .select("email,referred_by,utm_source,utm_medium,utm_campaign,created_at")
      .order("created_at", { ascending: false })
      .limit(10_000)
      .returns<WaitlistAnalyticsRow[]>(),
    supabase.from("beta_downloads").select("id", { count: "exact", head: true }),
  ]);

  if (waitlistResult.error) throw new Error(`Waitlist analytics failed: ${waitlistResult.error.message}`);
  // The beta table was added later; keep the rest of the dashboard available
  // if an older environment has not applied that migration yet.
  const betaDownloads = betaResult.error ? 0 : betaResult.count ?? 0;
  const waitlistRows = (waitlistResult.data ?? []).filter(
    (row) => !isProbeWaitlistEmail(row.email),
  );
  return {
    waitlist: summarizeWaitlist(waitlistRows),
    betaDownloads,
  };
}
