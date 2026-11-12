import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cleanText, feedbackDb } from "@/lib/feedback";
import { clientNetwork, rejectCrossSitePost } from "@/lib/publicForm";
import { consumeRateLimit, GLOBAL_KEY, type RateLimitDecision, type RateLimitRule } from "@/lib/rateLimit";
import { WEB_SURVEY_MAX_COMMENT, WEB_SURVEY_OPTIONS, type WebSurveyAnswer } from "@/lib/webSurveyText";

/**
 * The one-question PMF survey on unvibe.site/survey (BOSS: the emailed survey's day-3 check was 1
 * reply from 8 sends; Security pre-rules 20261107-1217). Anonymous (W2 b): no name, email, install
 * ID, account or token. Opening the page stores nothing (W1, T2); only the Send POST handled here
 * writes, one row in `public.pmf_responses` (migration 20261030120000, service role only) through
 * `submit_pmf_response`, the same table and 12-month retention as the in-app survey. Web rows are
 * told apart by `app_version = 'web'`; their install key is 32 random bytes made per answer, so it
 * links to nothing. The comment goes in q4, the emailed survey's "How can we improve Unvibe for
 * you?". Comment text is never logged.
 */

export const WEB_SURVEY_MAX_BODY_BYTES = 16_384;
export const WEB_SURVEY_APP_VERSION = "web";

/** Per network (IPv6 by /64), hourly; and everyone together, daily. Counted in Supabase as keyed hashes, never raw IPs. */
export const WEB_SURVEY_IP_LIMIT: RateLimitRule = { name: "pmf-web-ip", windowSeconds: 3_600, max: 5 };
export const WEB_SURVEY_DAILY_LIMIT: RateLimitRule = { name: "pmf-web-day-all", windowSeconds: 86_400, max: 200 };

const ids = WEB_SURVEY_OPTIONS.map((option) => option.id) as [WebSurveyAnswer, ...WebSurveyAnswer[]];
const bodySchema = z
  .object({
    answer: z.enum(ids),
    comment: z.string().max(WEB_SURVEY_MAX_COMMENT * 2).optional().default(""),
  })
  .strict();

export interface WebSurveyRow {
  installKey: string;
  q1: (typeof WEB_SURVEY_OPTIONS)[number]["q1"];
  q4: string;
}

/** Strict parse: only `answer` (one of the 5 ids) and an optional `comment` of at most 2,000 characters after cleaning. */
export function parseWebSurvey(body: unknown): { row: Omit<WebSurveyRow, "installKey"> } | { error: string } {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "answer") return { error: "Pick one of the answers first." };
    if (field === "comment") return { error: "Keep the comment under 2,000 characters." };
    return { error: "Something in the form didn't look right. Reload the page and try again." };
  }
  const comment = cleanText(parsed.data.comment);
  if (comment.length > WEB_SURVEY_MAX_COMMENT) return { error: "Keep the comment under 2,000 characters." };
  const option = WEB_SURVEY_OPTIONS.find((o) => o.id === parsed.data.answer)!;
  return { row: { q1: option.q1, q4: comment } };
}

export interface WebSurveyDeps {
  consume: (rule: RateLimitRule, key: string) => Promise<RateLimitDecision>;
  store: (row: WebSurveyRow) => Promise<"stored" | "unavailable">;
  newInstallKey: () => string;
}

async function storeInPmfResponses(row: WebSurveyRow): Promise<"stored" | "unavailable"> {
  const db = feedbackDb();
  if (!db) return "unavailable";
  const { data, error } = await db.rpc("submit_pmf_response", {
    p_install_key: row.installKey,
    p_q1: row.q1,
    p_q2: "",
    p_q3: "",
    p_q4: row.q4,
    p_app_version: WEB_SURVEY_APP_VERSION,
  });
  // Error code only: a check-constraint message could quote the comment.
  if (error) console.error("web survey store failed", error.code ?? "unknown");
  return !error && data === "ok" ? "stored" : "unavailable";
}

export const webSurveyDeps: WebSurveyDeps = {
  consume: consumeRateLimit,
  store: storeInPmfResponses,
  newInstallKey: () => randomBytes(32).toString("hex"),
};

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function reply(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** POST /api/survey. Never a 500: bad input is 400, limits 429, a store that can't be reached 503. */
export async function handleWebSurvey(request: Request, deps: WebSurveyDeps = webSurveyDeps): Promise<NextResponse> {
  const crossSite = rejectCrossSitePost(request);
  if (crossSite) return crossSite;
  if (Number(request.headers.get("content-length") ?? "0") > WEB_SURVEY_MAX_BODY_BYTES) {
    return reply(413, { error: "That's too long to send." });
  }
  const text = await request.text().catch(() => "");
  if (Buffer.byteLength(text) > WEB_SURVEY_MAX_BODY_BYTES) return reply(413, { error: "That's too long to send." });

  const network = await deps.consume(WEB_SURVEY_IP_LIMIT, clientNetwork(request));
  if (network === "limited") return reply(429, { error: "That's a lot of answers from this network. Try again in an hour." });
  if (network === "unavailable") return reply(503, { error: "Couldn't save that just now. Try again in a minute." });
  const everyone = await deps.consume(WEB_SURVEY_DAILY_LIMIT, GLOBAL_KEY);
  if (everyone === "limited") {
    // A fixed line to search the Vercel logs for: the survey is closed for the rest of the UTC day.
    console.error("web survey daily limit reached (pmf-web-day-all)");
    return reply(429, { error: "The survey has had all the answers it can take today. Try again tomorrow." });
  }
  if (everyone === "unavailable") return reply(503, { error: "Couldn't save that just now. Try again in a minute." });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: "Something in the form didn't look right. Reload the page and try again." });
  }
  const parsed = parseWebSurvey(body);
  if ("error" in parsed) return reply(400, { error: parsed.error });

  const result = await deps.store({ installKey: deps.newInstallKey(), ...parsed.row }).catch(() => {
    console.error("web survey store threw");
    return "unavailable" as const;
  });
  if (result !== "stored") return reply(503, { error: "Couldn't save that just now. Try again in a minute." });
  return reply(201, { ok: true });
}
