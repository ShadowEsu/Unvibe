import { trialInstallFromRequest, trialInstallMeta, trialUsageOverview } from '@/lib/trialAccess';
import { unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';

/** The app calls this at launch; the first call creates the install row (A-spec A1 first launch). */
export async function GET(req: Request): Promise<Response> {
  const installKey = trialInstallFromRequest(req);
  if (!installKey) return unauthorized();
  try {
    const overview = await trialUsageOverview(installKey, new Date(), trialInstallMeta(req));
    return Response.json(overview);
  } catch {
    return Response.json({ error: 'trial_usage_unavailable', message: 'Could not load trial usage.' }, { status: 503 });
  }
}
