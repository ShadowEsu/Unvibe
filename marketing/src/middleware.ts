import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { downloadFile, downloadSource, DOWNLOAD_FILES, isCountedDownload, recordDownload } from "@/lib/downloadCounter";
import { isCountedLoad, recordSiteLoad, siteLoadSource } from "@/lib/siteLoads";

const DOWNLOAD_PATH = /^\/download\/([a-z-]+)$/;

/**
 * Counts page loads per day by utm_source (src/lib/siteLoads.ts) and download link clicks per day by file and
 * utm_source (src/lib/downloadCounter.ts; the route at /download/<file> only redirects). The response is never
 * changed: no redirect, rewrite or header, and each count runs in `waitUntil` after the response is on its way,
 * so a slow or failing store never delays a page or a download. Vercel runs middleware before its edge cache,
 * so cached pages are counted too.
 */
export function middleware(request: NextRequest, event: NextFetchEvent): NextResponse {
  try {
    const { pathname, searchParams } = request.nextUrl;
    const header = (name: string) => request.headers.get(name);
    const file = downloadFile(DOWNLOAD_PATH.exec(pathname)?.[1] ?? "");
    if (file) {
      const req = { method: request.method, search: searchParams, header };
      if (isCountedDownload(req)) event.waitUntil(recordDownload(DOWNLOAD_FILES[file].asset, downloadSource(req)));
    } else if (isCountedLoad({ method: request.method, pathname, search: searchParams, header })) {
      event.waitUntil(recordSiteLoad(siteLoadSource(searchParams)));
    }
  } catch {
    console.error("site count failed");
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      // Pages only: no Next.js assets, API routes, link-preview cards or any path with a file extension
      // (install.sh, robots.txt, icons, llms.txt). Private pages are skipped in code (SKIPPED_PATH), where
      // a test covers them, so pages that merely start with the same letters (/statsig-…) still count.
      // The download links are left out here: Vercel runs the middleware once per matching entry, so a
      // browser's download click (Accept: text/html) that matched both entries was counted twice.
      source: "/((?!_next/|api/|og/|download/(?:mac|mac-intel|windows)/?$|.*\\.[a-zA-Z0-9]+$).*)",
      has: [{ type: "header", key: "accept", value: ".*text/html.*" }],
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    // The download links, whatever Accept header the browser sends (isCountedDownload decides what counts).
    "/download/:file(mac|mac-intel|windows)",
  ],
};
