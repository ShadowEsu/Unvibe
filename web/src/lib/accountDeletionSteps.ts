import Stripe from 'stripe';
import { errorSummary } from '@/billing/http';
import { getBillingStore } from '@/billing/store';
import { getStripe } from '@/billing/stripe';
import type { BillingOverview, SubscriptionRecord, WorkspaceAccess } from '@/billing/types';
import { liveSubscriptionStillCharges } from '@/billing/webhooks';
import type { AccountDeletion, Store } from '@/data/types';
import { accountDeletionServices } from '@/lib/accountDeletionServices';

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
    console.warn('account delete: stored subscription not found at Stripe; treated as not charging');
    return false;
  }
}

/** Where the Stripe preflight ended. clear carries the workspaces it read (none is created). */
export type BillingPreflight =
  | { result: 'clear'; workspaces: WorkspaceAccess[] }
  | { result: 'lookup_failed'; step: 'workspace lookup' | 'billing overview'; error: unknown }
  /** Stripe could not say whether a subscription still charges. */
  | { result: 'check_failed'; error: unknown }
  | { result: 'still_charges' };

/**
 * The Stripe preflight, shared by DELETE /api/v1/account and the daily sweep: over the workspaces
 * that exist, any subscription this account manages that Stripe can still charge stops the deletion,
 * and so does any billing state that cannot be read. Run before the account data is erased. Never throws.
 */
export async function billingPreflight(userId: string): Promise<BillingPreflight> {
  const billing = getBillingStore();
  let workspaces: WorkspaceAccess[];
  try {
    workspaces = await billing.existingWorkspaces(userId);
  } catch (error) {
    return { result: 'lookup_failed', step: 'workspace lookup', error };
  }
  for (const workspace of workspaces) {
    let overview: BillingOverview;
    try {
      overview = await billing.overview(userId, workspace.id);
    } catch (error) {
      return { result: 'lookup_failed', step: 'billing overview', error };
    }
    if (!overview.canManageBilling) continue;
    let charges: boolean;
    try {
      charges = await stillCharges(overview.subscription);
    } catch (error) {
      return { result: 'check_failed', error };
    }
    if (charges) return { result: 'still_charges' };
  }
  return { result: 'clear', workspaces };
}

/** Whether the account's public rows (workspaces and billing included) are already erased. */
export function accountErased(deletion: AccountDeletion): boolean {
  return deletion.step === 'app_data' || deletion.step === 'beta_downloads';
}

/** Where a run of the remaining deletion steps ended. */
export type DeletionRun =
  | { result: 'done' }
  /** The account is erased; only the Blob beta-download cleanup is left (recorded as failed). */
  | { result: 'cleanup_failed'; error: unknown }
  | { result: 'step_failed'; step: 'auth identity' | 'account data' | 'record done'; error: unknown };

/**
 * The steps after begin_account_deletion, shared by DELETE /api/v1/account and the daily sweep:
 * the Supabase Auth identity, the public rows in one transaction (the app token goes with the users
 * row), the site's Blob beta-download records, then done (the captured email is forgotten). Every
 * step can run again; the steps the row records as finished are skipped. Never throws.
 */
export async function runRemainingDeletionSteps(store: Store, deletion: AccountDeletion): Promise<DeletionRun> {
  const { userId } = deletion;
  const services = accountDeletionServices();
  const erased = accountErased(deletion);
  // The sign-in identity. Only Supabase Auth's own user_not_found counts as already gone.
  try {
    await services.auth.deleteUser(userId);
    if (!erased) await store.recordAccountDeletionStep(userId, 'auth_identity');
  } catch (error) {
    return { result: 'step_failed', step: 'auth identity', error };
  }
  if (!erased) {
    try {
      await store.eraseAccount(userId);
    } catch (error) {
      return { result: 'step_failed', step: 'account data', error };
    }
  }
  // The beta-download records for the email captured at the start, unless another account took that
  // address after the deletion started: then they are that account's. The account is gone by now,
  // so a record that cannot be read or deleted holds up only this cleanup.
  if (deletion.step !== 'beta_downloads') {
    try {
      const outcome = deletion.email && (await store.addressReusedSinceDeletion(userId, deletion.email))
        ? 'email_reused'
        : await services.betaDownloads.deleteForEmail(deletion.email);
      await store.recordAccountDeletionStep(userId, 'beta_downloads', outcome);
    } catch (error) {
      await store.recordAccountDeletionStep(userId, 'app_data', 'failed').catch((recordError: unknown) => {
        console.error('account delete: recording the beta-download failure failed', errorSummary(recordError));
      });
      return { result: 'cleanup_failed', error };
    }
  }
  try {
    await store.finishAccountDeletion(userId);
  } catch (error) {
    return { result: 'step_failed', step: 'record done', error };
  }
  return { result: 'done' };
}
