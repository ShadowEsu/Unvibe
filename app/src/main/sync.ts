/** Best-effort background sync. Never throws into callers; failures leave events queued. */
import { store } from './store';
import { pullEvents, pushEvents } from './backend';

let inFlight = false;
let retryTimer: NodeJS.Timeout | null = null;
let failures = 0;

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'waiting' | 'error';
  pending: number;
  message: string;
}

let current: SyncStatus = { state: 'idle', pending: 0, message: 'Up to date' };

export function syncStatus(): SyncStatus {
  return { ...current, pending: store().pending().length };
}

function nextRetry(): void {
  if (retryTimer) return;
  const delay = Math.min(60_000, 1_000 * 2 ** Math.min(failures, 6));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

export async function flush(): Promise<void> {
  if (inFlight) return;
  const token = store().token();
  const pending = store().pending();
  if (!token) {
    current = { state: 'idle', pending: 0, message: 'Sign in to sync across devices' };
    return;
  }
  inFlight = true;
  current = { state: 'syncing', pending: pending.length, message: 'Syncing learning' };
  try {
    if (pending.length > 0) {
      const accepted = await pushEvents(token, pending);
      store().markSynced(accepted);
    }
    store().mergeRemote(await pullEvents(token));
    failures = 0;
    current = { state: 'idle', pending: store().pending().length, message: 'Up to date' };
  } catch {
    failures += 1;
    current = { state: 'waiting', pending: store().pending().length, message: 'Learning is saved here and will retry automatically.' };
    nextRetry();
  } finally {
    inFlight = false;
  }
}
