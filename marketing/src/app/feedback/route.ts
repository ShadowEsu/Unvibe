import { BETA_SURVEY_URL } from "@/lib/betaOffer";
import { recordBetaInstallEvent } from "@/lib/betaInstallStats";
import { captureServerEvent } from "@/lib/posthogServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Count every open of the public feedback link, including email paste, then send people to Typeform. */
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
