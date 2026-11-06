import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isCountedLoad, recordSiteLoad, siteLoadSource } from "@/lib/siteLoads";

/**
 * Counts page loads per day by utm_source (src/lib/siteLoads.ts). The response is never changed: no
 * redirect, rewrite or header, and the count runs in `waitUntil` after the page is on its way. Vercel
 * runs middleware before its edge cache, so cached pages are counted too.
 */
export function middleware(request: NextRequest, event: NextFetchEvent): NextResponse {
  try {
    const { pathname, searchParams } = request.nextUrl;
    const counted = isCountedLoad({
      method: request.method,
      pathname,
      search: searchParams,
      header: (name) => request.headers.get(name),
    });
    if (counted) event.waitUntil(recordSiteLoad(siteLoadSource(searchParams)));
  } catch {
    console.error("site load count failed");
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      // Pages only: no Next.js assets, API routes, link-preview cards or any path with a file extension
      // (install.sh, robots.txt, icons, llms.txt). Private pages are skipped in code (SKIPPED_PATH), where
      // a test covers them, so pages that merely start with the same letters (/statsig-…) still count.
      source: "/((?!_next/|api/|og/|.*\\.[a-zA-Z0-9]+$).*)",
      has: [{ type: "header", key: "accept", value: ".*text/html.*" }],
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
