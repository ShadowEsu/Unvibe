import { isAdminStatsRequest, isQaFlagRequest } from '@/lib/adminStats';
import { serviceSupabase } from '@/lib/serviceSupabase';
import { trialInstallKey } from '@/lib/trialAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The real-device test calls this after its walkthrough so its install is left out of founder
 * stats. Accepts the CI-only UNVIBE_QA_FLAG_TOKEN, or the admin token until CI no longer holds it.
 * Body: { installId } (the app's random install ID).
 *
 * Answers { ok: true, matched }: matched is true only when the app had already registered that
 * install and its row is now flagged. When nothing matched, a flagged row is still written so a
 * later registration starts as QA, but the caller learns that the app's own row was not found
 * (wrong id, or the app never reached the API), and CI fails on it (Security, 31 Oct).
 */
export async function POST(req: Request): Promise<Response> {
  if (!isQaFlagRequest(req) && !isAdminStatsRequest(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { installId?: unknown } | null;
  const installId = typeof body?.installId === 'string' ? body.installId.trim() : '';
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(installId)) return Response.json({ error: 'bad installId' }, { status: 400 });
  const db = serviceSupabase();
  if (!db) return Response.json({ error: 'unavailable' }, { status: 503 });
  const installKey = trialInstallKey(installId);
  const updated = await db.from('trial_installs').update({ qa: true }).eq('install_key', installKey).select('install_key');
  if (updated.error) {
    console.error('qa install flag failed', updated.error.message);
    return Response.json({ error: 'write_failed' }, { status: 500 });
  }
  if ((updated.data ?? []).length > 0) return Response.json({ ok: true, matched: true });
  const { error } = await db.from('trial_installs').upsert({ install_key: installKey, qa: true }, { onConflict: 'install_key' });
  if (error) {
    console.error('qa install flag failed', error.message);
    return Response.json({ error: 'write_failed' }, { status: 500 });
  }
  return Response.json({ ok: true, matched: false });
}
