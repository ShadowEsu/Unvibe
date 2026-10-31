/**
 * One stdout line per hosted explanation request, so a slow or failed explanation on a test machine can
 * be matched to the server request (the device-test harness reads main-process output). It carries only
 * the server's request id, status and timings: never code, text, tokens or the install id.
 */
export type ReviewOutcome = 'done' | 'timeout' | 'error' | 'aborted' | 'consent';

export interface ReviewTrace {
  /** The `x-vercel-id` response header, or null when no response arrived. */
  id: string | null;
  status: number | null;
  firstTokenMs: number | null;
  totalMs: number;
  outcome: ReviewOutcome;
}

export const REVIEW_TRACE_PREFIX = '[unvibe-review]';

/** Header values come from the network: keep only id characters, so a value can't add lines or fields. */
function safeId(id: string | null): string {
  const clean = (id ?? '').replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 100);
  return clean || 'none';
}

function ms(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'none' : String(Math.max(0, Math.round(value)));
}

export function reviewTraceLine(trace: ReviewTrace): string {
  return `${REVIEW_TRACE_PREFIX} id=${safeId(trace.id)} status=${trace.status ?? 'none'} first_token_ms=${ms(trace.firstTokenMs)} total_ms=${ms(trace.totalMs)} outcome=${trace.outcome}`;
}
