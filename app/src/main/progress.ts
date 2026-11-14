/**
 * Setup progress, off by default (instrumentation spec 2026-10-22 section 7, first-run spec section 4).
 * One write-once ping per step to POST /api/v1/trial/progress: body `{ "step": ... }`, the trial
 * token and the random install ID, never the session token, never code, files or email. Only sealed
 * trial builds send; dev and founder builds and the "Send setup progress" setting off send
 * nothing. A step is marked sent on 2xx or 400 (a bad step is never retried); anything else (offline,
 * 409 no install row yet, 429, 5xx) is retried by `syncProgress` on the next launch.
 * `heard_from` is different: it carries the optional first-run answer to "Where did you hear about
 * Unvibe?" (`answerHeardFrom`). Typing it and pressing Continue is its own opt-in (Security 0046,
 * option A), so it goes from sealed trial builds whether or not the setting is on, once, and is kept
 * locally only until the server has it.
 * `window_shown` is the other exception (BOSS counter fix, ledger 620, Marketing §10 C): sent once when
 * the first main window has been visible for 3 seconds, from sealed trial builds whether or not the
 * setting is on. Like every step it carries the step name with the trial token, the install ID, the
 * system and the app version (`trialAuthHeaders`), which the launch usage check already sends; the
 * server keeps only the step and its time. It helps tell a person who saw the window apart from a
 * launch-only run (the post-upload link checker, or a window that opened hidden). Security 0656: GO on
 * the design; Preston's show must say it sends with the setting off and no click.
 */
import { setTimeout as sleep } from 'node:timers/promises';
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
  | 'login_prompt_accepted'
  | 'heard_from'
  | 'window_shown';

export interface ProgressDeps {
  /** Sealed trial build and not a founder build. */
  trialBuild: () => boolean;
  /** `trialBuild` and the "Send setup progress" setting is on. */
  enabled: () => boolean;
  platform: NodeJS.Platform;
  sent: (step: ProgressStep) => boolean;
  markSent: (step: ProgressStep) => void;
  /** The first-run answer waiting to be sent, or null. */
  heardFrom: () => string | null;
  saveHeardFrom: (answer: string) => void;
  /** The first main window was visible for 3 s on some launch (local truth for `window_shown`). */
  windowShown: () => boolean;
  markWindowShown: () => void;
  /** HTTP status, or null when the request never completed. `answer` only for `heard_from`. */
  post: (step: ProgressStep, answer?: string) => Promise<number | null>;
}

/** The server keeps at most this many characters of the answer (web `sanitizeHeardFrom`). */
const HEARD_FROM_MAX_CHARS = 200;

const inFlight = new Set<ProgressStep>();
/** Windows has no Accessibility grant to ask for or report. */
const MAC_ONLY: Partial<Record<ProgressStep, true>> = { accessibility: true, accessibility_asked: true };

/** The answer as the server would store it: control characters dropped, whitespace collapsed, capped. */
export function cleanHeardFrom(value: unknown): string {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/[^\P{Cc}\s]|\p{Cf}|\p{Cs}/gu, '').replace(/\s+/g, ' ').trim();
  return Array.from(clean).slice(0, HEARD_FROM_MAX_CHARS).join('').trimEnd();
}

/** Testable core of `reportProgress`. */
export async function sendProgress(step: ProgressStep, deps: ProgressDeps): Promise<void> {
  // The first-run answer is its own opt-in and the window marker carries nothing; every other step needs the setting.
  const allowed = step === 'heard_from' || step === 'window_shown' ? deps.trialBuild() : deps.enabled();
  if ((MAC_ONLY[step] && deps.platform !== 'darwin') || !allowed || deps.sent(step) || inFlight.has(step)) return;
  const answer = step === 'heard_from' ? deps.heardFrom() : undefined;
  if (answer === null) return;
  inFlight.add(step);
  try {
    const status = await deps.post(step, answer).catch(() => null);
    if (status !== null && ((status >= 200 && status < 300) || status === 400)) deps.markSent(step);
  } finally {
    inFlight.delete(step);
  }
}

const trialBuild = () => trialBuildEnabled() && !fullProductBuildEnabled();
const liveDeps: ProgressDeps = {
  trialBuild,
  enabled: () => trialBuild() && settings().all().shareSetupProgress === true,
  platform: process.platform,
  sent: (step) => store().progressSent(step),
  markSent: (step) => store().markProgressSent(step),
  heardFrom: () => store().heardFromAnswer(),
  saveHeardFrom: (answer) => store().saveHeardFromAnswer(answer),
  windowShown: () => store().windowShown(),
  markWindowShown: () => store().markWindowShown(),
  // aiAuthHeaders(null): the install ID and the session token never travel together.
  post: (step, answer) => postTrialProgress(step, aiAuthHeaders(null), answer),
};

export function reportProgress(step: ProgressStep): void {
  void sendProgress(step, liveDeps);
}

/**
 * The optional first-run answer, sent when the person presses Continue with something typed. Blank
 * sends nothing. Typing it is the opt-in, so the setup-progress setting does not gate it; only sealed
 * trial builds send it. Kept until the server has it and sent once.
 */
export async function answerHeardFrom(answer: unknown, deps: ProgressDeps = liveDeps): Promise<void> {
  const clean = cleanHeardFrom(answer);
  if (!clean || !deps.trialBuild() || deps.sent('heard_from')) return;
  deps.saveHeardFrom(clean);
  await sendProgress('heard_from', deps);
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
    // Sends only when a first-run answer is still waiting.
    sendProgress('heard_from', deps),
    deps.windowShown() ? sendProgress('window_shown', deps) : undefined,
  ]);
}

/** How long the first window must stay visible before it counts as seen. */
export const WINDOW_SHOWN_AFTER_MS = 3000;

/**
 * Called when a main window is shown: after 3 s, if it is still visible, the local truth is saved and
 * the marker sent (once ever; later launches only retry a send that never got through).
 */
export function noteWindowShown(
  win: { isDestroyed(): boolean; isVisible(): boolean },
  deps: ProgressDeps = liveDeps,
  wait: (ms: number) => Promise<void> = (ms) => sleep(ms),
): Promise<void> {
  if (deps.windowShown()) return Promise.resolve();
  return wait(WINDOW_SHOWN_AFTER_MS).then(() => {
    if (win.isDestroyed() || !win.isVisible()) return;
    deps.markWindowShown();
    return sendProgress('window_shown', deps);
  });
}
