import { isAdminStatsRequest } from '@/lib/adminStats';
import { serviceSupabase } from '@/lib/serviceSupabase';
import { trialInstallKey } from '@/lib/trialAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The real-device test calls this after its walkthrough so its install is left out of founder
 * stats. Requires UNVIBE_ADMIN_STATS_TOKEN. Body: { installId } (the app's random install ID).
 */
export async function POST(req: Request): Promise<Response> {
  if (!isAdminStatsRequest(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { installId?: unknown } | null;
  const installId = typeof body?.installId === 'string' ? body.installId.trim() : '';
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(installId)) return Response.json({ error: 'bad installId' }, { status: 400 });
  const db = serviceSupabase();
  if (!db) return Response.json({ error: 'unavailable' }, { status: 503 });
  const { error } = await db.from('trial_installs').upsert({ install_key: trialInstallKey(installId), qa: true }, { onConflict: 'install_key' });
  if (error) {
    console.error('qa install flag failed', error.message);
    return Response.json({ error: 'write_failed' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
