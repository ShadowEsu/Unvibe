/**
 * Anonymous setup progress (instrumentation spec 2026-10-22 section 7, first-run spec section 4).
 * One write-once ping per step to POST /api/v1/trial/progress: body `{ "step": ... }`, the trial
 * token and the random install ID, never the session token, never code, files or email. Only sealed
 * trial builds send; dev and founder builds and the "Send setup progress" setting off send
 * nothing. A step is marked sent on 2xx or 400 (a bad step is never retried); anything else (offline,
 * 409 no install row yet, 429, 5xx) is retried by `syncProgress` on the next launch.
 */
import { aiAuthHeaders, postTrialProgress } from './backend';
import { settings } from './settings';
import { store } from './store';
import { fullProductBuildEnabled, trialBuildEnabled } from './trial';

export type ProgressStep =
  | 'onboarded'
  | 'accessibility'
  | 'signed_in'
  | 'accessibility_asked'
  | 'level_answered'
  | 'login_prompt_shown'
  | 'login_prompt_accepted';

export interface ProgressDeps {
  /** Sealed trial build, not a founder build, and the setting is on. */
  enabled: () => boolean;
  platform: NodeJS.Platform;
  sent: (step: ProgressStep) => boolean;
  markSent: (step: ProgressStep) => void;
  /** HTTP status, or null when the request never completed. */
  post: (step: ProgressStep) => Promise<number | null>;
}

const inFlight = new Set<ProgressStep>();
/** Windows has no Accessibility grant to ask for or report. */
const MAC_ONLY: Partial<Record<ProgressStep, true>> = { accessibility: true, accessibility_asked: true };

/** Testable core of `reportProgress`. */
export async function sendProgress(step: ProgressStep, deps: ProgressDeps): Promise<void> {
  if ((MAC_ONLY[step] && deps.platform !== 'darwin') || !deps.enabled() || deps.sent(step) || inFlight.has(step)) return;
  inFlight.add(step);
  try {
    const status = await deps.post(step).catch(() => null);
    if (status !== null && ((status >= 200 && status < 300) || status === 400)) deps.markSent(step);
  } finally {
    inFlight.delete(step);
  }
}

const liveDeps: ProgressDeps = {
  enabled: () => trialBuildEnabled() && !fullProductBuildEnabled() && settings().all().shareSetupProgress === true,
  platform: process.platform,
  sent: (step) => store().progressSent(step),
  markSent: (step) => store().markProgressSent(step),
  // aiAuthHeaders(null): the install ID and the session token never travel together.
  post: (step) => postTrialProgress(step, aiAuthHeaders(null)),
};

export function reportProgress(step: ProgressStep): void {
  void sendProgress(step, liveDeps);
}

/**
 * Re-derive the steps that have local truth and send any that never got through. Runs after the
 * launch usage check, which creates the server's install row, so the first pings find it.
 */
export async function syncProgress(
  local: { onboarded: boolean; accessibilityGranted: boolean; signedIn: boolean },
  deps: ProgressDeps = liveDeps,
): Promise<void> {
  await Promise.all([
    local.onboarded ? sendProgress('onboarded', deps) : undefined,
    local.accessibilityGranted ? sendProgress('accessibility', deps) : undefined,
    local.signedIn ? sendProgress('signed_in', deps) : undefined,
  ]);
}
