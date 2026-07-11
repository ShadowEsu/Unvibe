/** Best-effort background sync. Never throws into callers; failures leave events queued. */
import { store } from './store';
import { pushEvents } from './backend';

let inFlight = false;

export async function flush(): Promise<void> {
  if (inFlight) return;
  const token = store().token();
  const pending = store().pending();
  if (!token || pending.length === 0) return;
  inFlight = true;
  try {
    const accepted = await pushEvents(token, pending);
    store().markSynced(accepted);
  } catch {
    // stays queued; retried on the next flush (next review, or app focus)
  } finally {
    inFlight = false;
  }
}
