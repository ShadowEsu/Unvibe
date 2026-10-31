import { betaWindowsInstallScript } from "@/lib/betaInstallScript";
import { recordBetaInstallEvent } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await recordBetaInstallEvent("fetched");
  } catch (error) {
    console.error("install fetch count failed", error);
  }
  return new Response(betaWindowsInstallScript(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": "inline; filename=install.ps1",
      "Cache-Control": "no-store",
    },
  });
}
