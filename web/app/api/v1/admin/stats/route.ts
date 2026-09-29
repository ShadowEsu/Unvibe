import { installStats, isAdminStatsRequest } from '@/lib/adminStats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Founder-only aggregate install counts. Requires UNVIBE_ADMIN_STATS_TOKEN as a bearer token. */
export async function GET(req: Request): Promise<Response> {
  if (!isAdminStatsRequest(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  try {
    return Response.json(await installStats(), { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'stats_unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
