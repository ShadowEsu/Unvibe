/**
 * "Delete my account" (signed in) and "Erase everything" (signed out). The service is asked first;
 * data on this computer goes only after it answers that the account is gone, so a refusal or an
 * outage leaves everything here as it was and a retry still has the session to try with.
 */
import { clearAiKey, hasAiKey } from './aiKey';
import { deleteAccount, type AccountDeletionStatus } from './backend';
import { knowledgeStore } from './knowledgeStore';
import { settings } from './settings';
import { store } from './store';

export type AccountDeletionResult =
  | { ok: true; status: AccountDeletionStatus | 'erased_locally' }
  | { ok: false; error: string };

function reason(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Removes what belongs to the deleted account on this computer: the saved API key, the name, email,
 * gift code and project folder in settings, the knowledge store, and last the learning store with the
 * session token. The token goes last so a failure earlier leaves a session that can retry the deletion.
 */
function clearAccountData(): void {
  clearAiKey();
  if (hasAiKey()) throw new Error('The API key saved in Unvibe could not be removed.');
  settings().forgetPerson();
  knowledgeStore().wipe();
  store().wipeEverything();
}

export async function deleteAccountAndLocalData(): Promise<AccountDeletionResult> {
  const token = store().token();
  if (!token) {
    // Signed out: no account to delete. Erase the learning on this computer, as before.
    try {
      store().wipeEverything();
      knowledgeStore().wipe();
    } catch (err) {
      return { ok: false, error: reason(err, 'Learning on this computer could not be erased.') };
    }
    return { ok: true, status: 'erased_locally' };
  }
  let status: AccountDeletionStatus;
  try {
    status = await deleteAccount(token);
  } catch (err) {
    return { ok: false, error: reason(err, 'Delete failed.') };
  }
  try {
    clearAccountData();
  } catch (err) {
    return {
      ok: false,
      error: `Your account was deleted, but some data on this computer could not be removed. ${reason(err, '')} Try again to finish.`.replace(/\s+/g, ' ').trim(),
    };
  }
  return { ok: true, status };
}
