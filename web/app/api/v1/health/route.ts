export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public liveness only. Never reports credentials, provider configuration, or user data. */
export async function GET(): Promise<Response> {
  return Response.json(
    { ok: true, service: 'unvibe-api', version: 'v1' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
