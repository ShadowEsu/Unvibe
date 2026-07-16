import type { IncomingEvent } from './types';

const OUTCOMES = new Set(['reviewed', 'understood', 'needs_review']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isIncomingEvent(value: unknown): value is IncomingEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<IncomingEvent>;
  return typeof event.id === 'string'
    && UUID.test(event.id)
    && typeof event.ts === 'string'
    && Number.isFinite(Date.parse(event.ts))
    && typeof event.scope === 'string'
    && event.scope.length > 0
    && event.scope.length <= 64
    && typeof event.level === 'string'
    && event.level.length > 0
    && event.level.length <= 32
    && typeof event.outcome === 'string'
    && OUTCOMES.has(event.outcome)
    && (event.localDate === undefined || /^\d{4}-\d{2}-\d{2}$/.test(event.localDate))
    && (event.lines === undefined || (Number.isInteger(event.lines) && event.lines >= 0 && event.lines <= 1_000_000));
}
