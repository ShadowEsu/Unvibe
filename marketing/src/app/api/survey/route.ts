import { handleWebSurvey } from "@/lib/webSurvey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The /survey page's Send. POST only: there is no GET, so opening a link can never record an answer. */
export function POST(request: Request) {
  return handleWebSurvey(request);
}
