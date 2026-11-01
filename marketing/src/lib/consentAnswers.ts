/**
 * Server side of the daily count of analytics-bar answers (BOSS 30 Oct, option a; Security C-3/C-4 in
 * requests/unvibe/20261030-0737-security-consent-answer-count.md): how many times visitors pressed
 * Allow and No thanks, per Pacific day. Consent record-keeping, not tracking. The route reads only the
 * body (at most 64 bytes) and no header at all: no IP, user agent, referrer or cookie. It stores only
 * the day and a count (migration 0011) and never logs the request.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsChoice } from "@/lib/analyticsConsent";
import { dayKey } from "@/lib/siteStatsStore";

/** `{"answer":"allow"}` is 17 bytes; a body over this is refused unread. */
export const CONSENT_ANSWER_MAX_BYTES = 64;

/** The answer from a body that is exactly `{"answer":"allow"}` or `{"answer":"deny"}`, else null. */
export function parseConsentAnswer(text: string): AnalyticsChoice | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "answer") return null;
  const { answer } = body as { answer: unknown };
  return answer === "allow" || answer === "deny" ? answer : null;
}

/** Reads at most `limit` bytes of the body; null if there are more (the rest is never read). */
export async function readBodyUpTo(req: Request, limit = CONSENT_ANSWER_MAX_BYTES): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export type ConsentAnswerRpc = (day: string, answer: AnalyticsChoice) => Promise<{ error: unknown }>;

let cachedClient: SupabaseClient | null = null;

function usableEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "[SENSITIVE]" || trimmed.toLowerCase() === "sensitive") return undefined;
  return trimmed;
}

/** The service-role call, or null when storage isn't configured. */
export function supabaseConsentAnswerRpc(): ConsentAnswerRpc | null {
  const url = usableEnv(process.env.SUPABASE_URL);
  const key = usableEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) return null;
  cachedClient ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  const client = cachedClient;
  return async (day, answer) => {
    const { error } = await client.rpc("record_consent_answer", { p_day: day, p_answer: answer });
    return { error };
  };
}

/** The HTTP status for one posted answer: 204 counted, 400 not exactly the form, 503 storage down. */
export async function handleConsentAnswer(
  req: Request,
  rpc: ConsentAnswerRpc | null = supabaseConsentAnswerRpc(),
  now = new Date(),
): Promise<number> {
  const text = await readBodyUpTo(req);
  const answer = text === null ? null : parseConsentAnswer(text);
  if (!answer) return 400;
  if (!rpc) return 503;
  const { error } = await rpc(dayKey(now), answer).catch((e: unknown) => ({ error: e }));
  if (error) {
    console.error("consent answer count failed:", error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "error"));
    return 503;
  }
  return 204;
}
