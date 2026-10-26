import { errorSummary } from '@/billing/http';
import { getStore } from '@/data/store';
import { cronSecret, isCronRequest, sweepAccountDeletions } from '@/lib/accountDeletionSweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily Vercel Cron (web/vercel.json): finishes account deletions left started for over an hour and
 * answers counts only. Fails closed: without CRON_SECRET it refuses every call.
 */
export async function GET(req: Request): Promise<Response> {
  const secret = cronSecret();
  if (!secret) {
    console.error('account deletion sweep: CRON_SECRET is not set (16+ characters); refusing');
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!isCronRequest(req, secret)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await sweepAccountDeletions(getStore())) });
  } catch (error) {
    console.error('account deletion sweep: failed', errorSummary(error));
    return Response.json({ error: 'sweep_unavailable' }, { status: 503 });
  }
}
