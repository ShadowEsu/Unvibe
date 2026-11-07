import { downloadFile, downloadSource, DOWNLOAD_FILES, isCountedDownload, recordDownload, type DownloadRequest } from "@/lib/downloadCounter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /download/mac, /download/mac-intel and /download/windows: count the click (src/lib/downloadCounter.ts),
 * then send the browser to that file on GitHub Releases. Only those three names exist (anything else is a
 * 404, so this can't redirect anywhere else) and nothing from the request's query is passed on. /download
 * itself stays the 308 to /beta in next.config.mjs.
 */
async function serve(request: Request, params: { file: string }): Promise<Response> {
  const file = downloadFile(params.file);
  if (!file) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const url = new URL(request.url);
  const req: DownloadRequest = {
    method: request.method,
    search: url.searchParams,
    header: (name) => request.headers.get(name),
    origin: url.origin,
  };
  if (isCountedDownload(req)) await recordDownload(DOWNLOAD_FILES[file].asset, downloadSource(req));

  return new Response(null, {
    status: 302,
    headers: { Location: DOWNLOAD_FILES[file].url, "Cache-Control": "no-store" },
  });
}

export function GET(request: Request, { params }: { params: { file: string } }): Promise<Response> {
  return serve(request, params);
}

export function HEAD(request: Request, { params }: { params: { file: string } }): Promise<Response> {
  return serve(request, params);
}
