/**
 * The daily account-deletion sweep (GET /api/v1/internal/account-deletions/sweep, Vercel Cron).
 * After a second Blob failure DELETE answers deleted and the app forgets its token, so no client
 * retry ever comes: this finishes the deletions left started, and alerts on the ones that stay.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { errorSummary } from '@/billing/http';
import type { AccountDeletion, Store } from '@/data/types';
import { accountErased, billingPreflight, runRemainingDeletionSteps, type BillingPreflight, type DeletionRun } from '@/lib/accountDeletionSteps';

/** A deletion still started an hour after it began is retried here. */
export const SWEEP_STALE_AFTER_MS = 60 * 60_000;
/** One still started after 7 days raises ACCOUNT_DELETION_OVERDUE (the runbook's 30-day path starts). */
export const SWEEP_OVERDUE_AFTER_MS = 7 * 24 * 60 * 60_000;
/** Each row can list every Blob record, so a small cap keeps one run inside the function time limit. */
export const SWEEP_LIMIT = 10;
/**
 * The run stops retrying rows after 40 s, 20 s inside the route's maxDuration (60 s), so it always
 * gets to count what is left and write its counts line.
 */
export const SWEEP_TIME_BUDGET_MS = 40_000;
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
  /** Stale rows listed for this run (at most SWEEP_LIMIT). */
  found: number;
  /** Listed rows the run started on before its time budget ran out. */
  checked: number;
  done: number;
  /** Account erased; the Blob cleanup failed again (recorded as failed on the row). */
  cleanupPending: number;
  /** An earlier step (Auth identity, account data, record done) failed. */
  failed: number;
  /** Not erased: a subscription can still charge, or the billing state could not be read. Left started. */
  skipped: number;
  /** Started rows older than an hour: after this run, or before it when the budget stopped it. */
  stale: number;
  /** Started rows older than 7 days: after this run, or before it when the budget stopped it. */
  overdue: number;
  /** The time budget ran out before every listed row was finished. */
  stoppedOnBudget: boolean;
}

/** Resolves 'out_of_time' if `work` takes longer than `ms`; the work itself keeps going. */
async function within<T>(work: Promise<T>, ms: number): Promise<T | 'out_of_time'> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'out_of_time'>((resolve) => { timer = setTimeout(() => resolve('out_of_time'), ms); });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

type SweepRun = DeletionRun | { result: 'skipped'; preflight: Exclude<BillingPreflight, { result: 'clear' }> };

/**
 * One row. Before its account data is erased, the same Stripe preflight as DELETE: a workspace
 * Stripe may still charge (or whose billing cannot be read) is never erased here. A row left stuck
 * (skipped, or failed at Auth or erase) moves to the back of the list, so stuck rows cannot fill
 * every run's slots; only updated_at changes, and the stale and overdue clocks count from
 * started_at. Never throws.
 */
async function retryDeletion(store: Store, deletion: AccountDeletion): Promise<SweepRun> {
  const preflight = accountErased(deletion) ? undefined : await billingPreflight(deletion.userId);
  const run: SweepRun = preflight && preflight.result !== 'clear'
    ? { result: 'skipped', preflight }
    : await runRemainingDeletionSteps(store, deletion);
  if (run.result === 'skipped' || (run.result === 'step_failed' && (run.step === 'auth identity' || run.step === 'account data'))) {
    await store.touchAccountDeletion(deletion.userId).catch((error: unknown) => {
      console.error('account deletion sweep: moving a stuck row back failed', errorSummary(error));
    });
  }
  return run;
}

/**
 * Counts the stale and overdue rows, retries the stale deletions until the time budget runs out, then
 * counts again, and logs one ACCOUNT_DELETION_SWEEP counts line on every run (plus
 * ACCOUNT_DELETION_OVERDUE when any row is overdue). A row cut off by the budget moves to the
 * back of the list: every step can run again, so a later run finishes it. Listing or counting errors throw.
 */
export async function sweepAccountDeletions(store: Store, budgetMs: number = SWEEP_TIME_BUDGET_MS): Promise<SweepCounts> {
  const deadline = Date.now() + budgetMs;
  // Counted before the loop, so a run the budget stops still reports (and alerts on) them.
  let stale = await store.staleAccountDeletionCount(SWEEP_STALE_AFTER_MS);
  let overdue = await store.staleAccountDeletionCount(SWEEP_OVERDUE_AFTER_MS);
  const rows = await store.staleAccountDeletions(SWEEP_STALE_AFTER_MS, SWEEP_LIMIT);
  let checked = 0;
  let done = 0;
  let cleanupPending = 0;
  let failed = 0;
  let skipped = 0;
  let stoppedOnBudget = false;
  for (const deletion of rows) {
    const left = deadline - Date.now();
    const run = left >= 15_000 ? await within(retryDeletion(store, deletion), left) : 'out_of_time';
    if (run === 'out_of_time') {
      stoppedOnBudget = true;
      await store.touchAccountDeletion(deletion.userId).catch((error: unknown) => {
        console.error('account deletion sweep: moving a stuck row back failed', errorSummary(error));
      });
      console.error('account deletion sweep: row cut off at budget');
      break;
    }
    checked += 1;
    if (run.result === 'done') {
      done += 1;
    } else if (run.result === 'cleanup_failed') {
      cleanupPending += 1;
      console.error('account deletion sweep: beta-download records failed', errorSummary(run.error));
    } else if (run.result === 'skipped') {
      // Left started: the next run checks again, and the overdue alert and the 30-day path still see it.
      skipped += 1;
      const { preflight } = run;
      if (preflight.result === 'still_charges') {
        console.error('account deletion sweep: skipped, a subscription can still charge');
      } else {
        console.error(`account deletion sweep: skipped, ${preflight.result === 'check_failed' ? 'subscription check' : preflight.step} failed`, errorSummary(preflight.error));
      }
    } else {
      failed += 1;
      console.error(`account deletion sweep: ${run.step} failed`, errorSummary(run.error));
    }
  }
  if (!stoppedOnBudget) {
    stale = await store.staleAccountDeletionCount(SWEEP_STALE_AFTER_MS);
    overdue = await store.staleAccountDeletionCount(SWEEP_OVERDUE_AFTER_MS);
  }
  const counts = { found: rows.length, checked, done, cleanupPending, failed, skipped, stale, overdue, stoppedOnBudget };
  console.log('account deletion sweep: counts', JSON.stringify({ code: 'ACCOUNT_DELETION_SWEEP', ...counts }));
  if (overdue > 0) {
    console.error('account deletion sweep: deletions overdue', JSON.stringify({ code: 'ACCOUNT_DELETION_OVERDUE', ...counts }));
  }
  return counts;
}
