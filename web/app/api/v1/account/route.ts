import Stripe from 'stripe';
import { getStore } from '@/data/store';
import type { AccountDeletion } from '@/data/types';
import { TeamHasMembersError } from '@/data/teamHasMembers';
import { bearerToken, sessionTokenHash, sessionUser, userFromRequest, unauthorized } from '@/lib/auth';
import { runRemainingDeletionSteps } from '@/lib/accountDeletionSteps';
import { getBillingStore } from '@/billing/store';
import { errorSummary } from '@/billing/http';
import { getStripe } from '@/billing/stripe';
import type { BillingOverview, SubscriptionRecord, WorkspaceAccess, WorkspaceMember } from '@/billing/types';
import { liveSubscriptionStillCharges } from '@/billing/webhooks';

export const runtime = 'nodejs';

/**
 * Whether Stripe can still charge this subscription. Lifetime is a one-time payment, and a canceled
 * subscription stays canceled. Anything else is decided on the live Stripe subscription, not the
 * stored row: a portal change ("Don't cancel", or a new cancel) can be seconds ahead of its webhook.
 * A subscription Stripe does not have (resource_missing) cannot charge. Any other error throws.
 */
async function stillCharges(subscription: SubscriptionRecord): Promise<boolean> {
  const id = subscription.stripeSubscriptionId;
  if (!id || subscription.status === 'canceled') return false;
  if (subscription.interval === 'lifetime') return false;
  try {
    return liveSubscriptionStillCharges(await getStripe().subscriptions.retrieve(id));
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.code !== 'resource_missing') throw error;
    console.warn('account delete: stored subscription not found at Stripe; treated as not charging', id);
    return false;
  }
}

/** Who am I — used by the app to show the signed-in identity. */
export async function GET(req: Request): Promise<Response> {
  const userId = await userFromRequest(req);
  if (!userId) {
    return unauthorized();
  }
  return Response.json(await getStore().accountInfo(userId));
}

const NOT_STARTED = 'Nothing was deleted. Try again in a minute.';
const NOT_FINISHED = 'Your account is not fully deleted yet. Try again in a minute to finish.';
const BLOB_PENDING = 'Your account and its data are deleted. One cleanup step did not finish. Try again in a minute.';
/** The account is erased; only the Blob beta-download cleanup (and the address kept for it) is left. */
const CLEANUP_PENDING = 'Your account and app data are deleted. We could not check for beta-download records just now; any we find, and the email address kept to find them, will be removed within 30 days.';

/** Provider errors (Stripe, Supabase, Blob) can quote account details: only errorSummary reaches the log. */
function unavailable(step: string, error: unknown, message: string): Response {
  console.error(`account delete: ${step} failed`, errorSummary(error));
  return Response.json({ error: 'deletion_unavailable', message }, { status: 503 });
}

/** The browser session cookie holds the app token, which no longer resolves; the browser drops it too. */
function deleted(status: 'deleted' | 'already_deleted', message?: string): Response {
  return Response.json({ ok: true, status, ...(message ? { message } : {}) }, { headers: { 'set-cookie': 'uncode_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' } });
}

/** Refused before anything was recorded or deleted. */
function teamHasMembers(): Response {
  return Response.json({ error: 'team_has_members', message: new TeamHasMembersError().message }, { status: 409 });
}

/**
 * App Store requirement: an authenticated user can delete their account and all their data.
 *
 * Order: Stripe preflight, the Teams rule, record started (email and token hash), then the steps
 * in runRemainingDeletionSteps: the Supabase Auth identity, the public rows in one transaction
 * (tokens go last, by cascade, so every earlier failure can be retried with the same token), the
 * site's Blob beta-download records, record done. Every step can run again; a retry skips the
 * steps the deletion row says are finished. Nothing here creates a workspace or a users row.
 */
export async function DELETE(req: Request): Promise<Response> {
  const token = bearerToken(req);
  if (!token) return unauthorized();
  const store = getStore();
  const tokenHash = sessionTokenHash(token);
  let userId: string;
  // A deletion already under way may have done some steps; a 503 must not say nothing was deleted.
  let notDone = NOT_STARTED;
  try {
    const session = await sessionUser(req);
    if (session) {
      userId = session.userId;
      if (session.deleting) notDone = NOT_FINISHED;
    } else {
      // The token no longer resolves. If it asked for a deletion, that deletion finished (and its
      // response was lost) or stopped after the account rows were erased: answer or finish it.
      const deletion = await store.accountDeletionForToken(tokenHash);
      if (!deletion) return unauthorized();
      if (deletion.state === 'done') return deleted('already_deleted');
      userId = deletion.userId;
      notDone = NOT_FINISHED;
    }
  } catch (error) {
    return unavailable('session lookup', error, NOT_STARTED);
  }

  // 1. Stripe preflight, over the workspaces that exist (none is created here).
  const billing = getBillingStore();
  let workspaces: WorkspaceAccess[];
  try {
    workspaces = await billing.existingWorkspaces(userId);
  } catch (error) {
    return unavailable('workspace lookup', error, notDone);
  }
  for (const workspace of workspaces) {
    let overview: BillingOverview;
    try {
      overview = await billing.overview(userId, workspace.id);
    } catch (error) {
      return unavailable('billing overview', error, notDone);
    }
    if (!overview.canManageBilling) continue;
    let charges: boolean;
    try {
      charges = await stillCharges(overview.subscription);
    } catch (error) {
      // Unknown billing state: never delete an account Stripe might keep charging.
      console.error('account delete: subscription check failed', errorSummary(error));
      return Response.json({ error: 'billing_unavailable', message: `We could not check your subscription. ${notDone}` }, { status: 503 });
    }
    if (charges) {
      return Response.json({ error: 'active_subscription', message: 'Cancel the active subscription in Manage billing before deleting this account.' }, { status: 409 });
    }
  }

  // 2. Teams rule: an owned team with other members would take their data with it.
  for (const workspace of workspaces) {
    if (workspace.type === 'personal' || workspace.ownerUserId !== userId) continue;
    let members: WorkspaceMember[];
    try {
      members = await billing.listMembers(userId, workspace.id);
    } catch (error) {
      return unavailable('team members lookup', error, notDone);
    }
    if (members.some((member) => member.userId !== userId)) return teamHasMembers();
  }

  // 3. Started: from here nothing re-creates or writes to this account. begin repeats the Teams
  // check under the workspace locks, so a member who joined after step 2 is refused here too.
  let deletion: AccountDeletion;
  try {
    deletion = await store.beginAccountDeletion(userId, (await store.accountInfo(userId)).email, tokenHash);
  } catch (error) {
    if (error instanceof TeamHasMembersError && notDone === NOT_STARTED) return teamHasMembers();
    return unavailable('record started', error, notDone);
  }
  if (deletion.state === 'done') return deleted('already_deleted');
  // A retry of a deletion that started over an hour ago: the stale-row alert, with no email or id.
  const ageMinutes = Math.floor((Date.now() - Date.parse(deletion.startedAt)) / 60_000);
  if (notDone === NOT_FINISHED && ageMinutes >= 60) {
    console.error('account delete: stale deletion resumed', JSON.stringify({ code: 'ACCOUNT_DELETION_STALE', ageMinutes, step: deletion.step }));
  }

  // 4-7. Auth identity, the public rows, the Blob beta-download records, done.
  const run = await runRemainingDeletionSteps(store, deletion);
  if (run.result === 'step_failed') return unavailable(run.step, run.error, NOT_FINISHED);
  if (run.result === 'cleanup_failed') {
    // The account is gone, so a Blob record that cannot be read holds up only this cleanup: the
    // first failure gets a 503 the same token retries; a second answers deleted and leaves the row
    // started, with the email, for the daily sweep (and the runbook after 7 days).
    if (deletion.betaDownloads !== 'failed') return unavailable('beta-download records', run.error, BLOB_PENDING);
    console.error('account delete: beta-download cleanup left for follow-up', JSON.stringify({ code: 'ACCOUNT_DELETION_BLOB_PENDING', error: errorSummary(run.error) }));
    // Still status deleted (the account is gone, and the app clears its local data only on
    // deleted); the message says what is left and by when it is removed.
    return deleted('deleted', CLEANUP_PENDING);
  }
  return deleted('deleted');
}
