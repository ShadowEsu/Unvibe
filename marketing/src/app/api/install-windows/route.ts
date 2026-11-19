import { betaWindowsInstallScript } from "@/lib/betaInstallScript";
import { countInstallScriptFetch } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await countInstallScriptFetch(req.url, "win_fetched");
  return new Response(betaWindowsInstallScript(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": "inline; filename=install.ps1",
      "Cache-Control": "no-store",
    },
  });
}
