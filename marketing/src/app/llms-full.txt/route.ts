import { llmsFullTxt } from "@/lib/llmsText";

// Route files may export only Next's route fields (the API build failed on one that didn't, #152).
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(llmsFullTxt(), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
