import { betaInstallScript } from "@/lib/betaInstallScript";
import { recordBetaInstallEvent } from "@/lib/betaInstallStats";
import { captureServerEvent } from "@/lib/posthogServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await recordBetaInstallEvent("fetched");
    await captureServerEvent("beta_install_fetched", "install-mac", { os: "mac" });
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
