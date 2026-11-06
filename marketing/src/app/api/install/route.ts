import { betaInstallScript } from "@/lib/betaInstallScript";
import { recordBetaInstallEvent, recordInstallScriptDay } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Started first so it runs alongside the all-time write; it never throws and waits at most 1 s.
  const dayCount = recordInstallScriptDay("mac_fetched");
  try {
    await recordBetaInstallEvent("fetched");
  } catch (error) {
    console.error("install fetch count failed", error);
  }
  await dayCount;
  return new Response(betaInstallScript(), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Content-Disposition": "inline; filename=install.sh",
      "Cache-Control": "no-store",
    },
  });
}
