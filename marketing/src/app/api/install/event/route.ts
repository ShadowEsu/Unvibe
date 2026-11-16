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
    // The install scripts no longer post 'installed' (Kaspersky read the call back as C&C; Security R4(a)). Copies cached
    // before that still do: answer them, record nothing. Installs are counted from the app's own first launch.
    if (event === "installed") return new NextResponse(null, { status: 204 });
    const counts = await recordBetaInstallEvent(event);
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    console.error("install event failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
