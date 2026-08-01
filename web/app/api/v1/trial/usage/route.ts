import { trialInstallFromRequest, trialUsageOverview } from '@/lib/trialAccess';
import { unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const installKey = trialInstallFromRequest(req);
  if (!installKey) return unauthorized();
  try {
    const overview = await trialUsageOverview(installKey);
    return Response.json(overview);
  } catch {
    return Response.json({ error: 'trial_usage_unavailable', message: 'Could not load trial usage.' }, { status: 503 });
  }
}
