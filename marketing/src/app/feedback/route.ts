import { BETA_SURVEY_URL } from "@/lib/betaOffer";
import { recordBetaInstallEvent } from "@/lib/betaInstallStats";
import { captureServerEvent } from "@/lib/posthogServer";
import { cleanText, clientIp, FEEDBACK_BONUS_MIN_WORDS, feedbackDb, feedbackSchema, hashIp, wordCount } from "@/lib/feedback";
import { verifyEmailSignature } from "@/lib/rewardLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Count every open of the public feedback link, then send people to the PostHog survey. */
export async function GET() {
  try {
    await recordBetaInstallEvent("survey");
    await captureServerEvent("feedback_opened", "feedback-redirect", {
      source: "feedback_route",
    });
    await captureServerEvent("survey_opened", "feedback-redirect", {
      source: "feedback_route",
    });
  } catch (error) {
    console.error("feedback count failed", error);
  }
  return Response.redirect(BETA_SURVEY_URL, 302);
}

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function limited(key: string): boolean {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  times.push(now);
  recent.set(key, times);
  if (recent.size > 5_000) recent.clear();
  return times.length > MAX_PER_WINDOW;
}

/** Stars plus up to 100 words, from the site or the desktop app. Stored server-side only. */
export async function POST(request: Request) {
  const noStore = { "Cache-Control": "no-store" };
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 8_000) return Response.json({ error: "Too long." }, { status: 413, headers: noStore });
  const ipHash = hashIp(clientIp(request));
  if (limited(ipHash)) return Response.json({ error: "Thanks! Give it a few minutes before sending more." }, { status: 429, headers: noStore });

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the form and try again." }, { status: 400, headers: noStore });
  }
  const input = parsed.data;
  // Honeypot filled in: pretend it worked so bots learn nothing.
  if (input.website) return Response.json({ ok: true }, { headers: noStore });

  const db = feedbackDb();
  if (!db) return Response.json({ error: "Feedback is not available right now." }, { status: 503, headers: noStore });
  const { error } = await db.from("site_feedback").insert({
    rating: input.rating,
    message: cleanText(input.message),
    email: input.email ? input.email.toLowerCase() : null,
    source: input.source,
    page: input.page ? cleanText(input.page).slice(0, 200) : null,
    app_version: input.appVersion ? cleanText(input.appVersion).slice(0, 40) : null,
    ip_hash: ipHash,
  });
  if (error) {
    console.error("feedback insert failed", error.message);
    return Response.json({ error: "Could not save that. Try again in a moment." }, { status: 500, headers: noStore });
  }
  await captureServerEvent("feedback_submitted", ipHash, { rating: input.rating, source: input.source }).catch(() => undefined);

  // From the welcome email: a signed link plus a real message earns one more month of Pro.
  let bonus: "granted" | "already" | "too_short" | undefined;
  if (input.email && input.claim && verifyEmailSignature(input.email, input.claim)) {
    if (wordCount(input.message) < FEEDBACK_BONUS_MIN_WORDS) {
      bonus = "too_short";
    } else {
      const { data, error: grantError } = await db.rpc("grant_bonus_month", { p_email: input.email.toLowerCase(), p_reason: "feedback" });
      if (grantError) console.error("feedback bonus grant failed", grantError.message);
      else bonus = data === true ? "granted" : "already";
    }
  }
  return Response.json({ ok: true, bonus }, { headers: noStore });
}
