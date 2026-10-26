import { errorSummary } from '@/billing/http';
import type { AccountDeletion, Store } from '@/data/types';
import { accountDeletionServices } from '@/lib/accountDeletionServices';

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
  const erased = deletion.step === 'app_data' || deletion.step === 'beta_downloads';
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
