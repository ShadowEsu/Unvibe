import { NextResponse } from "next/server";
import { parseBetaInstallEvent, recordBetaInstallEvent } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { event?: unknown } | null;
    const event = parseBetaInstallEvent(body?.event);
    if (!event || event === "fetched") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const counts = await recordBetaInstallEvent(event);
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    console.error("install event failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
