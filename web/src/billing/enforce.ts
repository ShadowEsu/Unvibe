import { getBillingStore } from './store';
import type { UsageKind } from './types';

export async function reserveMeteredAction(userId: string, kind: UsageKind, req: Request): Promise<Response | null> {
  const workspaceId = req.headers.get('x-uncode-workspace-id')?.trim() || undefined;
  try {
    const reservation = await getBillingStore().reserveUsage(userId, kind, workspaceId);
    if (reservation.allowed) return null;
    await getBillingStore().recordAudit(userId, workspaceId ?? null, 'upgrade_prompt.impression', { kind, used: reservation.line.used, limit: reservation.line.limit });
    const resets = reservation.line.resetsAt
      ? new Date(reservation.line.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
      : 'next month';
    const label = kind === 'ai_explanation' ? 'explanations' : kind.replaceAll('_', ' ');
    return Response.json({
      error: 'plan_limit_reached',
      message: reservation.line.remaining <= 0
        ? `You have reached your monthly ${label} limit (${reservation.line.limit}). Your allowance resets on ${resets}. Saved history and settings stay available.`
        : `You have used ${reservation.line.used} of ${reservation.line.limit} ${label} this month.`,
      usage: reservation.line,
      upgradePath: '/plan',
    }, { status: 429 });
  } catch {
    return Response.json({ error: 'entitlements_unavailable', message: 'We could not verify your plan safely. Try again shortly.' }, { status: 503 });
  }
}
