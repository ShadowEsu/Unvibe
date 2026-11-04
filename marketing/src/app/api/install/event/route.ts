import { NextResponse } from "next/server";
import { parseSiteInstallEvent, recordBetaInstallCopySource, recordBetaInstallEvent } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Founder install counts from the site (`recordBetaSiteEvent`, sent only after Allow on the analytics
 * bar). Body `{ event }`, or `{ event: "copied", source }` with a listed first-touch label
 * (installSource.ts). The label adds one to that day's count for it; nothing else is kept.
 */
export async function POST(req: Request) {
  try {
    const parsed = parseSiteInstallEvent(await req.json().catch(() => null));
    if (!parsed) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const counts = await recordBetaInstallEvent(parsed.event);
    if (parsed.source) {
      await recordBetaInstallCopySource(parsed.source).catch((error: unknown) => {
        console.error("install copy source count failed", error instanceof Error ? error.name : "error");
      });
    }
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    console.error("install event failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
