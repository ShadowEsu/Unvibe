import type { EventRecord } from './types';

export interface HistoryCursor {
  ts: string;
  id: string;
}

export function encodeHistoryCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeHistoryCursor(value?: string): HistoryCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<HistoryCursor>;
    if (typeof parsed.ts !== 'string' || !Number.isFinite(Date.parse(parsed.ts))) return undefined;
    if (typeof parsed.id !== 'string' || parsed.id.length === 0 || parsed.id.length > 256) return undefined;
    return { ts: parsed.ts, id: parsed.id };
  } catch {
    return undefined;
  }
}

export function compareHistoryDescending(a: Pick<EventRecord, 'ts' | 'id'>, b: Pick<EventRecord, 'ts' | 'id'>): number {
  const time = b.ts.localeCompare(a.ts);
  return time || b.id.localeCompare(a.id);
}

export function isAfterCursor(event: Pick<EventRecord, 'ts' | 'id'>, cursor: HistoryCursor): boolean {
  return event.ts < cursor.ts || (event.ts === cursor.ts && event.id < cursor.id);
}

export function nextHistoryCursor(events: EventRecord[], limit: number): string | undefined {
  if (events.length < limit || events.length === 0) return undefined;
  const last = events[events.length - 1];
  return encodeHistoryCursor({ ts: last.ts, id: last.id });
}
