import type { TokenUsage } from '@/ai/provider';
import { getBillingStore } from './store';
import type { UsageKind } from './types';

/**
 * The workspace whose allowance pays for this call. A workspace named in the request is used only
 * while it is on a paid Teams plan; anything else spends the caller's personal allowance, so
 * creating free team workspaces cannot multiply the Free allowance. Throws for a workspace the
 * caller does not belong to.
 */
async function meteredWorkspace(userId: string, req: Request): Promise<string | undefined> {
  const requested = req.headers.get('x-uncode-workspace-id')?.trim();
  if (!requested) return undefined;
  const overview = await getBillingStore().overview(userId, requested);
  return overview.subscription.plan === 'teams' ? overview.workspace.id : undefined;
}

export async function reserveMeteredAction(userId: string, kind: UsageKind, req: Request): Promise<Response | null> {
  try {
    const workspaceId = await meteredWorkspace(userId, req);
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

/** Best effort: give back the unit `reserveMeteredAction` took when the AI produced nothing. */
export async function releaseMeteredAction(userId: string, kind: UsageKind, req: Request): Promise<void> {
  try {
    await getBillingStore().releaseUsage(userId, kind, await meteredWorkspace(userId, req));
  } catch (error: unknown) {
    console.error('usage release failed', error instanceof Error ? error.message : error);
  }
}

/** Best effort: write the provider's token counts onto the row `reserveMeteredAction` wrote. Never fails the request. */
export async function recordMeteredTokens(userId: string, kind: UsageKind, usage: TokenUsage): Promise<void> {
  await getBillingStore().recordUsageTokens(userId, kind, usage).catch((error: unknown) => {
    console.error('token count write failed', error instanceof Error ? error.message : error);
  });
}
