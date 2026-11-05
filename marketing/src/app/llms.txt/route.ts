import { llmsTxt } from "@/lib/llmsText";

// Route files may export only Next's route fields (the API build failed on one that didn't, #152).
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(llmsTxt(), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
