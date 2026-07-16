import type { LocalEvent } from './learning';

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
      events[idx] = event;
      merged += 1;
    }
  }
  events.sort((a, b) => a.ts.localeCompare(b.ts));
  return { events, merged };
}
