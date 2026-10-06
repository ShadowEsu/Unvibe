import { timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSiteStats, type SiteStatsSummary } from "@/lib/siteStatsStore";

/**
 * Numbers for Preston's private stats page. The page lives at /s/<STATS_PAGE_KEY>; anyone
 * without the key gets a 404, so the address itself is the secret.
 */

export function statsKeyMatches(candidate: string): boolean {
  const key = process.env.STATS_PAGE_KEY?.trim() ?? "";
  if (key.length < 16 || candidate.length !== key.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(key));
}

export interface ReleaseDownloads {
  total: number;
  mac: number;
  windows: number;
  latest: { tag: string; downloads: number } | null;
}

export interface FeedbackRow {
  rating: number;
  message: string;
  source: string;
  createdAt: string;
}

export interface PrivateStats {
  site: SiteStatsSummary | null;
  waitlist: { total: number; week: number; emailed: number; referred: number; fromApp: number; fromDownload: number } | null;
  app: { accounts: number; proGifted: number; explanations: number; checks: number } | null;
  referrals: { claims: number; feedbackMonths: number } | null;
  feedback: { count: number; average: number | null; recent: FeedbackRow[] } | null;
  tryIt: { total: number; today: number } | null;
  releases: ReleaseDownloads | null;
  errors: string[];
}

const INTERNAL = ["%@unvibe.internal"];

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function count(client: SupabaseClient, table: string, apply?: (q: any) => any): Promise<number> { // any: PostgREST builder types differ per table
  let query = client.from(table).select("*", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count: n, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
}

function since(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function releaseDownloads(): Promise<ReleaseDownloads> {
  const response = await fetch("https://api.github.com/repos/ShadowEsu/Unvibe/releases?per_page=50", {
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`GitHub releases ${response.status}`);
  const releases = (await response.json()) as Array<{ tag_name: string; assets: Array<{ name: string; download_count: number }> }>;
  let mac = 0;
  let windows = 0;
  for (const release of releases) {
    for (const asset of release.assets) {
      if (/\.dmg$|mac/i.test(asset.name)) mac += asset.download_count;
      else if (/\.exe$|win/i.test(asset.name)) windows += asset.download_count;
    }
  }
  const latest = releases[0]
    ? { tag: releases[0].tag_name, downloads: releases[0].assets.reduce((sum, a) => sum + (/\.(dmg|exe)$/i.test(a.name) ? a.download_count : 0), 0) }
    : null;
  return { total: mac + windows, mac, windows, latest };
}

export async function getPrivateStats(): Promise<PrivateStats> {
  const errors: string[] = [];
  const attempt = async <T>(label: string, run: () => Promise<T>): Promise<T | null> => {
    try { return await run(); } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : "failed"}`);
      return null;
    }
  };
  const client = db();
  if (!client) errors.push("Supabase is not configured, so only site traffic and GitHub numbers show.");
  const notInternal = (q: any) => q.not("email", "like", INTERNAL[0]); // any: see count()

  const [site, waitlist, app, referrals, feedback, tryIt, releases] = await Promise.all([
    attempt("Site traffic", () => getSiteStats()),
    client ? attempt("Waitlist", async () => ({
      total: await count(client, "waitlist_entries", notInternal),
      week: await count(client, "waitlist_entries", (q) => notInternal(q).gte("created_at", since(7))),
      emailed: await count(client, "waitlist_entries", (q) => q.eq("beta_email_status", "sent")),
      referred: await count(client, "waitlist_entries", (q) => q.not("referred_by", "is", null).neq("referred_by", "")),
      fromApp: await count(client, "waitlist_entries", (q) => q.eq("utm_source", "app")),
      fromDownload: await count(client, "waitlist_entries", (q) => q.eq("utm_source", "download")),
    })) : null,
    client ? attempt("App", async () => ({
      accounts: await count(client, "users"),
      proGifted: await count(client, "subscriptions", (q) => q.eq("plan", "pro").eq("status", "trialing").gt("current_period_end", new Date().toISOString())),
      explanations: await count(client, "events"),
      checks: await count(client, "understanding_checks"),
    })) : null,
    client ? attempt("Referrals", async () => ({
      claims: await count(client, "gift_claims"),
      feedbackMonths: await count(client, "bonus_pro_grants"),
    })) : null,
    client ? attempt("Feedback", async () => {
      const { data, error } = await client.from("site_feedback").select("rating,message,source,created_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const average = rows.length ? rows.reduce((sum, r) => sum + Number(r.rating), 0) / rows.length : null;
      return {
        count: rows.length,
        average,
        recent: rows.slice(0, 12).map((r) => ({ rating: Number(r.rating), message: String(r.message ?? ""), source: String(r.source ?? ""), createdAt: String(r.created_at) })),
      };
    }) : null,
    client ? attempt("Try it", async () => ({
      total: await count(client, "try_requests"),
      today: await count(client, "try_requests", (q) => q.gte("created_at", since(1))),
    })) : null,
    attempt("GitHub downloads", () => releaseDownloads()),
  ]);
  return { site, waitlist, app, referrals, feedback, tryIt, releases, errors };
}
