/** Durable outbox sync with remote reconciliation and bounded exponential retry. */
import { pullEvents, pushEvents } from './backend';
import { store } from './store';
import { retryDelayMs } from '../core/syncModel';

export type SyncPhase = 'local' | 'syncing' | 'synced' | 'offline' | 'auth_required' | 'error';
export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  lastSyncedAt?: string;
  nextRetryAt?: string;
  message?: string;
}

type Listener = (status: SyncStatus) => void;
const listeners = new Set<Listener>();
let status: SyncStatus = { phase: 'local', pending: 0 };
let inFlight: Promise<void> | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let retryAttempt = 0;

function publish(next: SyncStatus): void {
  status = next;
  for (const listener of listeners) listener({ ...status });
}

export function syncStatus(): SyncStatus {
  return { ...status, pending: store().pendingCount() };
}

export function onSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry(message: string, phase: 'offline' | 'error'): void {
  clearRetry();
  const delay = retryDelayMs(retryAttempt++);
  const nextRetryAt = new Date(Date.now() + delay).toISOString();
  publish({ phase, pending: store().pendingCount(), nextRetryAt, message });
  retryTimer = setTimeout(() => void flush(), delay);
  retryTimer.unref?.();
}

async function runSync(): Promise<void> {
  const token = store().token();
  if (!token) {
    clearRetry();
    publish({ phase: 'local', pending: store().pendingCount() });
    return;
  }

  publish({ phase: 'syncing', pending: store().pendingCount(), lastSyncedAt: status.lastSyncedAt });
  try {
    const pending = store().pending();
    if (pending.length > 0) {
      const accepted = await pushEvents(token, pending);
      store().markSynced(accepted);
    }
    const remote = await pullEvents(token);
    store().mergeRemote(remote);
    retryAttempt = 0;
    clearRetry();
    publish({ phase: 'synced', pending: store().pendingCount(), lastSyncedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed.';
    if (/session has expired/i.test(message)) {
      clearRetry();
      publish({ phase: 'auth_required', pending: store().pendingCount(), message });
    } else if (/could not reach/i.test(message)) {
      scheduleRetry(message, 'offline');
    } else {
      scheduleRetry(message, 'error');
    }
  }
}

export async function flush(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = runSync().finally(() => { inFlight = null; });
  return inFlight;
}

export async function retrySync(): Promise<void> {
  retryAttempt = 0;
  clearRetry();
  await flush();
}

export function stopSync(): void {
  clearRetry();
  listeners.clear();
}
