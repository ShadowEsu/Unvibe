import { betaInstallScript } from "@/lib/betaInstallScript";
import { recordBetaInstallEvent } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await recordBetaInstallEvent("fetched");
  } catch (error) {
    console.error("install fetch count failed", error);
  }
  return new Response(betaInstallScript(), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Content-Disposition": "inline; filename=install.sh",
      "Cache-Control": "no-store",
    },
  });
}
