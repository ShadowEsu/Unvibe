import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Request limits shared by every serverless instance. Calls are counted in Supabase
 * (public.consume_rate_limit, web/supabase/migrations/20261022080000_request_rate_limits.sql), so a cold
 * start or a second instance does not reset them. Function memory is used only in local
 * development; deployed, a missing or failing store means "unavailable" (fail closed).
 */

export interface RateLimitRule {
  /** Stable bucket prefix, e.g. "waitlist-ip". */
  name: string;
  windowSeconds: number;
  /** Calls allowed per window; the next one is limited. */
  max: number;
}

export type RateLimitDecision = "allowed" | "limited" | "unavailable";

/** One target address, counted across the waitlist and beta-download forms. */
export const SIGNUP_EMAIL_LIMIT: RateLimitRule = { name: "signup-email", windowSeconds: 3_600, max: 5 };

const memoryHits = new Map<string, { count: number; resetAt: number }>();
let cachedSupabase: SupabaseClient | null = null;

function supabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  cachedSupabase ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return cachedSupabase;
}

function consumeMemory(bucket: string, rule: RateLimitRule): RateLimitDecision {
  const now = Date.now();
  const entry = memoryHits.get(bucket);
  if (!entry || entry.resetAt <= now) {
    memoryHits.set(bucket, { count: 1, resetAt: now + rule.windowSeconds * 1_000 });
    return "allowed";
  }
  entry.count += 1;
  return entry.count > rule.max ? "limited" : "allowed";
}

/** Counts this call against the rule for `key` and says whether it may proceed. */
export async function consumeRateLimit(rule: RateLimitRule, key: string): Promise<RateLimitDecision> {
  // Raw IPs and emails never reach the store, only a hash of rule plus key.
  const digest = createHash("sha256").update(`${rule.name}:${key.trim().toLowerCase()}`).digest("hex").slice(0, 32);
  const bucket = `${rule.name}:${digest}`;
  const client = supabaseClient();
  if (client) {
    const { data, error } = await client.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_window_seconds: rule.windowSeconds,
      p_max: rule.max,
    });
    if (!error && typeof data === "boolean") return data ? "allowed" : "limited";
    console.error("rate limit store failed", error?.message ?? "unexpected response");
  }
  const localDevelopment = process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV;
  return localDevelopment ? consumeMemory(bucket, rule) : "unavailable";
}
