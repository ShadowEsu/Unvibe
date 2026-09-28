export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public installers remain unavailable until the signed-release checks pass. */
export async function GET() {
  return new Response(
    "Unvibe public installers are temporarily paused while signed-release verification is completed. Join the community at https://unvibe.site/#community for verified availability updates.\n",
    {
      status: 410,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
