/**
 * The daily account-deletion sweep (GET /api/v1/internal/account-deletions/sweep, Vercel Cron).
 * After a second Blob failure DELETE answers deleted and the app forgets its token, so no client
 * retry ever comes: this finishes the deletions left started, and alerts on the ones that stay.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { errorSummary } from '@/billing/http';
import type { Store } from '@/data/types';
import { runRemainingDeletionSteps } from '@/lib/accountDeletionSteps';

/** A deletion still started an hour after it began is retried here. */
export const SWEEP_STALE_AFTER_MS = 60 * 60_000;
/** One still started after 7 days raises ACCOUNT_DELETION_OVERDUE (the runbook's 30-day path starts). */
export const SWEEP_OVERDUE_AFTER_MS = 7 * 24 * 60 * 60_000;
/** Each row can list every Blob record, so a small cap keeps one run inside the function time limit. */
export const SWEEP_LIMIT = 10;
/** Vercel recommends a random CRON_SECRET of at least 16 characters; anything shorter is not configured. */
const MIN_SECRET_LENGTH = 16;

/** The configured CRON_SECRET, or undefined (unset or too short): the sweep then refuses every call. */
export function cronSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const secret = env.CRON_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : undefined;
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Compared as sha256 digests, in constant time. */
export function isCronRequest(req: Request, secret: string): boolean {
  const presented = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(presented), digest(secret));
}

/** Counts only: the sweep never reports an email or an account id. */
export interface SweepCounts {
  /** Stale rows retried in this run (at most SWEEP_LIMIT). */
  checked: number;
  done: number;
  /** Account erased; the Blob cleanup failed again (recorded as failed on the row). */
  cleanupPending: number;
  /** An earlier step (Auth identity, account data, record done) failed. */
  failed: number;
  /** Started rows older than an hour after this run. */
  stale: number;
  /** Started rows older than 7 days after this run. */
  overdue: number;
}

/** Retries the stale deletions, then counts what is left. Listing or counting errors throw. */
export async function sweepAccountDeletions(store: Store): Promise<SweepCounts> {
  const rows = await store.staleAccountDeletions(SWEEP_STALE_AFTER_MS, SWEEP_LIMIT);
  let done = 0;
  let cleanupPending = 0;
  let failed = 0;
  for (const deletion of rows) {
    const run = await runRemainingDeletionSteps(store, deletion);
    if (run.result === 'done') {
      done += 1;
    } else if (run.result === 'cleanup_failed') {
      cleanupPending += 1;
      console.error('account deletion sweep: beta-download records failed', errorSummary(run.error));
    } else {
      failed += 1;
      console.error(`account deletion sweep: ${run.step} failed`, errorSummary(run.error));
    }
  }
  const stale = await store.staleAccountDeletionCount(SWEEP_STALE_AFTER_MS);
  const overdue = await store.staleAccountDeletionCount(SWEEP_OVERDUE_AFTER_MS);
  const counts = { checked: rows.length, done, cleanupPending, failed, stale, overdue };
  if (overdue > 0) {
    console.error('account deletion sweep: deletions overdue', JSON.stringify({ code: 'ACCOUNT_DELETION_OVERDUE', ...counts }));
  }
  return counts;
}
