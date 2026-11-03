import { handleConsentAnswer } from "@/lib/consentAnswers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One analytics-bar answer for today's count (src/lib/consentAnswers.ts). */
export async function POST(req: Request) {
  const status = await handleConsentAnswer(req);
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}
