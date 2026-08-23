import { BETA_SURVEY_URL } from "@/lib/betaOffer";
import { recordBetaInstallEvent } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Count every open of the public feedback link, including email paste, then send people to Typeform. */
export async function GET() {
  try {
    await recordBetaInstallEvent("survey");
  } catch (error) {
    console.error("feedback count failed", error);
  }
  return Response.redirect(BETA_SURVEY_URL, 302);
}
