/**
 * "Delete my account" (signed in) and "Erase everything" (signed out). The service is asked first;
 * data on this computer goes only after it answers that the account is gone, so a refusal or an
 * outage leaves everything here as it was and a retry still has the session to try with.
 */
import { session } from 'electron';
import { clearAiKey, hasAiKey } from './aiKey';
import { deleteAccount, type AccountDeletionStatus } from './backend';
import { knowledgeStore } from './knowledgeStore';
import { settings } from './settings';
import { store } from './store';
import { cancelSync } from './sync';

export type AccountDeletionResult =
  | { ok: true; status: AccountDeletionStatus | 'erased_locally' }
  | { ok: false; error: string };

function reason(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Web storage the renderers can hold. Today they write only localStorage (review checklists keyed by
 * repository name, panel theme, feedback and greeting flags); the others are cleared in case a later
 * renderer uses them. Going through the session also removes what `removeItem` leaves in LevelDB.
 * Not cleared: the GPU shader cache, which holds no personal data.
 */
const RENDERER_STORAGES: NonNullable<Electron.ClearStorageDataOptions['storages']> = [
  'localstorage', 'indexdb', 'websql', 'filesystem', 'cookies', 'cachestorage', 'serviceworkers',
];

/**
 * Removes what belongs to the deleted account on this computer: the saved API key, the name, email,
 * gift code and project folder in settings, the knowledge store, renderer web storage and the HTTP
 * cache (responses fetched with the session), and last the learning store with the session token.
 * The token goes last so a failure earlier leaves a session that can retry the deletion.
 */
async function clearAccountData(): Promise<void> {
  clearAiKey();
  if (hasAiKey()) throw new Error('The API key saved in Unvibe could not be removed.');
  settings().forgetPerson();
  knowledgeStore().wipe();
  await session.defaultSession.clearStorageData({ storages: RENDERER_STORAGES });
  await session.defaultSession.clearCache();
  store().wipeEverything();
}

export const UNREADABLE_SIGN_IN = `Unvibe can't read your sign-in on this ${process.platform === 'win32' ? 'PC' : 'Mac'}. Sign in again, then delete.`;

/**
 * `stopReviews` ends every review in progress (the main process owns the panel and its sessions);
 * it runs before anything is cleared, so a review finishing late can't save a lesson back.
 */
export async function deleteAccountAndLocalData(stopReviews: () => void): Promise<AccountDeletionResult> {
  if (!store().account()) {
    // Signed out: no account to delete. Erase the learning on this computer, as before.
    try {
      stopReviews();
      store().wipeEverything();
      knowledgeStore().wipe();
    } catch (err) {
      return { ok: false, error: reason(err, 'Learning on this computer could not be erased.') };
    }
    return { ok: true, status: 'erased_locally' };
  }
  // An account whose token can't be decrypted (keychain locked, denied or reset, app re-signed) still
  // exists on the server. Never erase anything here as if it were deleted.
  const token = store().token();
  if (!token) return { ok: false, error: UNREADABLE_SIGN_IN };
  let status: AccountDeletionStatus;
  try {
    status = await deleteAccount(token);
  } catch (err) {
    return { ok: false, error: reason(err, 'Delete failed.') };
  }
  try {
    // A review or sync still running could otherwise write the deleted account's data back.
    stopReviews();
    await cancelSync();
    await clearAccountData();
  } catch (err) {
    return {
      ok: false,
      error: `Your account was deleted, but some data on this computer could not be removed. ${reason(err, '')} Try again to finish.`.replace(/\s+/g, ' ').trim(),
    };
  }
  return { ok: true, status };
}
