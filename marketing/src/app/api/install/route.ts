import { betaInstallScript } from "@/lib/betaInstallScript";
import { countInstallScriptFetch } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await countInstallScriptFetch(req.url, "mac_fetched");
  return new Response(betaInstallScript(), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Content-Disposition": "inline; filename=install.sh",
      "Cache-Control": "no-store",
    },
  });
}
