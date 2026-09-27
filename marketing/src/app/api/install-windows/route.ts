export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Windows access remains closed until device sign-in passes a clean-machine verification. */
export async function GET() {
  return new Response(
    "Unvibe Windows preview is temporarily paused while sign-in and signed-installer verification are completed. Join the community at https://unvibe.site/waitlist for verified availability updates.\n",
    {
      status: 410,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
