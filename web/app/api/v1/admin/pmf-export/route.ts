import { isAdminStatsRequest } from '@/lib/adminStats';
import { pmfExportRows } from '@/lib/pmfSurvey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Founder-only, read-only export of the PMF survey answers for the Feedback lane's scorer (FE-09).
 * Same bearer token as admin/stats (UNVIBE_ADMIN_STATS_TOKEN). Rows from the last 12 months (the
 * retention period), oldest first: `{ install_key, date: 'YYYY-MM-DD', q1, q2, q3, q4, app_version }`.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAdminStatsRequest(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  const rows = await pmfExportRows();
  if (!rows) return Response.json({ error: 'export_unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  return Response.json(rows, { headers: { 'cache-control': 'no-store' } });
}
