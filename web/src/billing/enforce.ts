import { getBillingStore } from './store';
import type { UsageKind } from './types';

export async function reserveMeteredAction(userId: string, kind: UsageKind, req: Request): Promise<Response | null> {
  const workspaceId = req.headers.get('x-uncode-workspace-id')?.trim() || undefined;
  try {
    const reservation = await getBillingStore().reserveUsage(userId, kind, workspaceId);
    if (reservation.allowed) return null;
    await getBillingStore().recordAudit(userId, workspaceId ?? null, 'upgrade_prompt.impression', { kind, used: reservation.line.used, limit: reservation.line.limit });
    return Response.json({
      error: 'plan_limit_reached',
      message: `You have used ${reservation.line.used} of ${reservation.line.limit} ${kind.replaceAll('_', ' ')} actions this month.`,
      usage: reservation.line,
      upgradePath: '/plan',
    }, { status: 429 });
  } catch {
    return Response.json({ error: 'entitlements_unavailable', message: 'We could not verify your plan safely. Try again shortly.' }, { status: 503 });
  }
}
