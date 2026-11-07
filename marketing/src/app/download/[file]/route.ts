import { downloadFile, DOWNLOAD_FILES } from "@/lib/downloadCounter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /download/mac, /download/mac-intel and /download/windows: send the browser to that file on GitHub Releases.
 * The click is counted in middleware.ts (in `waitUntil`, so this answer never waits on storage). Only those
 * three names exist (anything else is a 404, so this can't redirect anywhere else) and nothing from the
 * request's query is passed on. /download itself stays the 308 to /beta in next.config.mjs.
 */
function serve(params: { file: string }): Response {
  const file = downloadFile(params.file);
  if (!file) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(null, { status: 302, headers: { Location: DOWNLOAD_FILES[file].url, "Cache-Control": "no-store" } });
}

export function GET(_request: Request, { params }: { params: { file: string } }): Response {
  return serve(params);
}

export function HEAD(_request: Request, { params }: { params: { file: string } }): Response {
  return serve(params);
}
