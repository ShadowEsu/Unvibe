import type { LocalEvent } from './learning';

/**
 * Matches the backend cap in web/app/api/v1/events/route.ts (`events must contain at most 500
 * valid activity records`). Slightly conservative so large lesson bodies cannot push a batch
 * over a proxy body-size limit.
 */
export const EVENT_PUSH_BATCH_SIZE = 400;

/** Split events into backend-sized upload batches. Returns the events untouched when small. */
export function batchEvents<T>(events: readonly T[], batchSize = EVENT_PUSH_BATCH_SIZE): T[][] {
  if (batchSize < 1) return [events as T[]];
  const batches: T[][] = [];
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }
  return batches;
}

export function retryDelayMs(attempt: number, random = Math.random()): number {
  const base = Math.min(60_000, 1_000 * (2 ** Math.max(0, attempt)));
  return Math.round(base + base * 0.2 * Math.max(0, Math.min(1, random)));
}

export function mergeRemoteEvents(
  localEvents: LocalEvent[],
  pendingIds: string[],
  remoteEvents: LocalEvent[],
): { events: LocalEvent[]; merged: number } {
  const pending = new Set(pendingIds);
  const events = [...localEvents];
  let merged = 0;
  for (const event of remoteEvents) {
    const idx = events.findIndex((local) => local.id === event.id);
    if (idx < 0) {
      events.push(event);
      merged += 1;
    } else if (!pending.has(event.id)) {
      const previous = events[idx]!;
      // Keep on-device lesson bodies when the cloud mirror has none.
      events[idx] = {
        ...event,
        code: previous.code ?? event.code,
        explanation: previous.explanation ?? event.explanation,
      };
      merged += 1;
    }
  }
  events.sort((a, b) => a.ts.localeCompare(b.ts));
  return { events, merged };
}
