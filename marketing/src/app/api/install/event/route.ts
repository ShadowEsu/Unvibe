import { NextResponse } from "next/server";
import { parseBetaInstallEvent, recordBetaInstallEvent, recordInstallScriptDay } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { event?: unknown } | null;
    const event = parseBetaInstallEvent(body?.event);
    if (!event || event === "fetched") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // The scripts' finish post counts per day too; that call never throws and waits at most 1 s.
    const dayCount = event === "installed" ? recordInstallScriptDay("installed") : null;
    const counts = await recordBetaInstallEvent(event);
    await dayCount;
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    console.error("install event failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
