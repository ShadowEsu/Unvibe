/**
 * The companion's paste step ("Try it on your own code"), shown before Today. Each companion open the
 * user starts leads with it when, at that moment, setup is done and every saved lesson is the first-run
 * sample (or there is none). So the open that finishes setup doesn't (setup's last step just asked the
 * same), and neither does the rest of an open in which Erase everything ran. A login launch opens no
 * window, so it never counts as an open and shows nothing. "Not now" hides the step until the next
 * open. The first own-code explanation, from any path, ends it for good (settings.ownCodeExplained,
 * which Erase everything removes). Whether this open offers it lives only in this run of the app.
 */
import { ownCodeStepDue } from '../core/learning';
import { settings } from './settings';
import { store } from './store';

/** The open the user started last leads with the step; decided when it opened. */
let offered = false;

function due(): boolean {
  const s = settings().all();
  return ownCodeStepDue({ onboarded: s.onboarded, ownCodeExplained: s.ownCodeExplained === true, events: store().events() });
}

/** A companion open the user started: a new window, or one brought back from minimized. */
export function noteCompanionOpen(): void {
  offered = due();
}

export function ownCodeStepNotNow(): void {
  offered = false;
}

/** Called for every saved explanation that isn't the first-run sample. */
export function noteOwnCodeExplained(): void {
  if (!settings().all().ownCodeExplained) settings().set({ ownCodeExplained: true });
}

/**
 * What a finished explanation tells the companion's setup: the sample's answer is in (step 2 asks its
 * level question), or, while setup is still open, the user's own code was explained (the Mac setup
 * then offers the shortcut as step 4).
 */
export function firstRunEvent(sample: boolean): 'onboarding:sampleDone' | 'onboarding:ownCodeDone' | null {
  if (sample) return 'onboarding:sampleDone';
  return settings().all().onboarded ? null : 'onboarding:ownCodeDone';
}

export function ownCodeStepShown(): boolean {
  return offered && due();
}
