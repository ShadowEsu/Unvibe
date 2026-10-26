import Stripe from 'stripe';
import { getStore } from '@/data/store';
import type { AccountDeletion } from '@/data/types';
import { TeamHasMembersError } from '@/data/teamHasMembers';
import { bearerToken, sessionTokenHash, sessionUser, userFromRequest, unauthorized } from '@/lib/auth';
import { accountDeletionServices } from '@/lib/accountDeletionServices';
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

/** Provider errors (Stripe, Supabase, Blob) can quote account details: only errorSummary reaches the log. */
function unavailable(step: string, error: unknown, message: string): Response {
  console.error(`account delete: ${step} failed`, errorSummary(error));
  return Response.json({ error: 'deletion_unavailable', message }, { status: 503 });
}

/** The browser session cookie holds the app token, which no longer resolves; the browser drops it too. */
function deleted(status: 'deleted' | 'already_deleted'): Response {
  return Response.json({ ok: true, status }, { headers: { 'set-cookie': 'uncode_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' } });
}

/** Refused before anything was recorded or deleted. */
function teamHasMembers(): Response {
  return Response.json({ error: 'team_has_members', message: new TeamHasMembersError().message }, { status: 409 });
}

/**
 * App Store requirement: an authenticated user can delete their account and all their data.
 *
 * Order: Stripe preflight, the Teams rule, record started (email and token hash), Blob
 * beta-download records, the Supabase Auth identity, the public rows in one transaction (tokens go
 * last, by cascade, so every earlier failure can be retried with the same token), record done.
 * Every step can run again. Nothing here creates a workspace or a users row.
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

  const services = accountDeletionServices();
  // 4. The site's beta-download records for the email.
  try {
    await store.recordAccountDeletionStep(userId, 'beta_downloads', await services.betaDownloads.deleteForEmail(deletion.email));
  } catch (error) {
    return unavailable('beta-download records', error, NOT_FINISHED);
  }
  // 5. The sign-in identity. Only Supabase Auth's own user_not_found counts as already gone.
  try {
    await services.auth.deleteUser(userId);
    await store.recordAccountDeletionStep(userId, 'auth_identity');
  } catch (error) {
    return unavailable('auth identity', error, NOT_FINISHED);
  }
  // 6. The public rows, in one transaction; the app token goes with the users row.
  try {
    await store.eraseAccount(userId);
  } catch (error) {
    // Only reachable if a member joined between step 2 and step 3; the transaction deleted nothing.
    if (error instanceof TeamHasMembersError) return unavailable('account data (team has members)', error, error.message);
    return unavailable('account data', error, NOT_FINISHED);
  }
  // 7. Done: the captured email is forgotten.
  try {
    await store.finishAccountDeletion(userId);
  } catch (error) {
    return unavailable('record done', error, NOT_FINISHED);
  }
  return deleted('deleted');
}
