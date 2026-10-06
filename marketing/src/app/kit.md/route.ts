import { kitMarkdown } from "@/lib/kit";

/** Plain text kit for AI agents: one fetch, every fact and asset link. */
export function GET() {
  return new Response(kitMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
