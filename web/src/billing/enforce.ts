import { createHash } from 'node:crypto';
import type { TokenUsage } from '@/ai/provider';
import { getBillingStore } from './store';
import { FAIR_USE_RATE_LIMIT, FAIR_USE_RATE_LIMIT_TEXT, planDisplayName } from './plans';
import type { PlanId, UsageKind } from './types';

/**
 * The workspace whose allowance pays for this call, with its plan when that was already loaded. A
 * workspace named in the request is used only while it is on a paid Teams or Big Business plan;
 * anything else spends the caller's default allowance (an active Big Business workspace they hold a
 * named seat in, else their personal one), so creating free team workspaces cannot multiply the Free
 * allowance. Throws for a workspace the caller does not belong to.
 */
async function meteredWorkspace(userId: string, req: Request): Promise<{ workspaceId: string | undefined; plan?: PlanId }> {
  const requested = req.headers.get('x-uncode-workspace-id')?.trim();
  if (!requested) return { workspaceId: undefined };
  const overview = await getBillingStore().overview(userId, requested);
  const { plan } = overview.subscription;
  return plan === 'teams' || plan === 'business' ? { workspaceId: overview.workspace.id, plan } : { workspaceId: undefined };
}

/**
 * The 429 for a request over the fair-use rate limit, or null when it may go ahead (it is then
 * counted). Keyed by a hash of the account id, so each named seat has its own limit and no raw id is
 * stored or logged. An account's first hourly refusal in an hour logs one BUSINESS_RATE_LIMIT_HIT
 * line (hashed id, no text) for review.
 */
async function fairUseRefusal(userId: string, characters: number): Promise<Response | null> {
  const account = createHash('sha256').update(`unvibe-fair-use:${userId}`).digest('hex').slice(0, 32);
  const verdict = await getBillingStore().consumeFairUseRate(`fair-use:${account}`, characters, FAIR_USE_RATE_LIMIT);
  if (verdict.allowed) return null;
  if (verdict.alert) console.warn(JSON.stringify({ event: 'BUSINESS_RATE_LIMIT_HIT', account, window: 'hour' }));
  const seconds = verdict.retryAfterSeconds;
  const minutes = Math.ceil(seconds / 60);
  const wait = seconds < 60 ? `${seconds} second${seconds === 1 ? '' : 's'}` : `${minutes} minute${minutes === 1 ? '' : 's'}`;
  return Response.json({
    error: 'fair_use_rate_limited',
    message: `You have reached the ${FAIR_USE_RATE_LIMIT_TEXT}. Try again in ${wait}.`,
    retryAfterSeconds: seconds,
  }, { status: 429, headers: { 'retry-after': String(seconds) } });
}

/** The refusal for a Pro feature on Free or the trial, shaped like the 429 so clients show `message` and `upgradePath`. */
export function proRequired(): Response {
  return Response.json({
    error: 'pro_required',
    message: 'Git diff explanations, change briefs and since last understood compares are included with Unvibe Pro.',
    upgradePath: '/plan',
  }, { status: 402 });
}

/** A granted reservation: the workspace whose allowance paid for it, or undefined for the caller's personal allowance. */
export interface MeteredReservation {
  workspaceId: string | undefined;
}

/**
 * Takes one unit of the caller's allowance, or returns the response that refuses the call (429, 402
 * for a Pro feature the paying plan does not include, or 503 when the plan cannot be checked). The
 * plan of the workspace that would pay decides, and is checked before anything is reserved. An
 * unlimited allowance (Big Business) has no monthly cap; its one limit is the fair-use rate limit,
 * per person, counted with the request's `characters` (a refused request gives its unit back).
 */
export async function reserveMeteredAction(
  userId: string,
  kind: UsageKind,
  req: Request,
  options: { proOnly?: boolean; characters: number },
): Promise<Response | MeteredReservation> {
  try {
    const { workspaceId, plan } = await meteredWorkspace(userId, req);
    if (options.proOnly && (plan ?? (await getBillingStore().overview(userId)).subscription.plan) === 'free') return proRequired();
    const reservation = await getBillingStore().reserveUsage(userId, kind, workspaceId);
    const { limit, used } = reservation.line;
    if (reservation.allowed) {
      if (limit !== null) return { workspaceId };
      const refusal = await fairUseRefusal(userId, options.characters).catch(async (error: unknown) => {
        await releaseMeteredAction(userId, kind, { workspaceId });
        throw error;
      });
      if (!refusal) return { workspaceId };
      await releaseMeteredAction(userId, kind, { workspaceId });
      return refusal;
    }
    // Only a monthly cap refuses a reservation; an unlimited line never reaches one.
    if (limit === null) throw new Error('An unlimited allowance refused a reservation.');
    await getBillingStore().recordAudit(userId, workspaceId ?? null, 'upgrade_prompt.impression', { kind, used, limit });
    const resets = reservation.line.resetsAt
      ? new Date(reservation.line.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
      : 'next month';
    const label = kind === 'ai_explanation' ? 'explanations' : kind === 'project_question' ? 'questions' : kind.replaceAll('_', ' ');
    const limitText = limit.toLocaleString('en-US');
    const payingPlan = plan ?? (await getBillingStore().overview(userId)).subscription.plan;
    return Response.json({
      error: 'plan_limit_reached',
      message: used >= limit
        ? `You have reached your ${planDisplayName(payingPlan)} monthly ${label} limit (${limitText}). Your allowance resets on ${resets}. Saved history and settings stay available.`
        : `You have used ${used.toLocaleString('en-US')} of ${limitText} ${label} this month.`,
      usage: reservation.line,
      upgradePath: '/plan',
    }, { status: 429 });
  } catch {
    return Response.json({ error: 'entitlements_unavailable', message: 'We could not verify your plan safely. Try again shortly.' }, { status: 503 });
  }
}

/**
 * Best effort: give back the unit `reserveMeteredAction` took when the AI produced nothing. It goes
 * back to the workspace that was charged, even if the plan changed since (say Teams ended mid-request).
 */
export async function releaseMeteredAction(userId: string, kind: UsageKind, reservation: MeteredReservation): Promise<void> {
  try {
    await getBillingStore().releaseUsage(userId, kind, reservation.workspaceId);
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
