import { NextRequest, NextResponse } from "next/server";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";

export const dynamic = "force-dynamic";

/** A single Download CTA picks the supported desktop installer from the browser's OS. */
export function GET(request: NextRequest) {
  const agent = request.headers.get("user-agent") ?? "";
  if (/iphone|ipad|ipod|android|mobile/i.test(agent)) {
    return NextResponse.redirect(new URL("/#install", request.url), 307);
  }
  if (/windows/i.test(agent)) return NextResponse.redirect(BETA_WINDOWS_DIRECT_DOWNLOAD, 307);
  if (/macintosh|mac os x/i.test(agent)) return NextResponse.redirect(BETA_MAC_DIRECT_DOWNLOAD, 307);
  return NextResponse.redirect(new URL("/#install", request.url), 307);
}
