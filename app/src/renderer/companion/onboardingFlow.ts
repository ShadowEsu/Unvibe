/**
 * First run's flow, without the UI (Onboarding in companion.tsx draws it): which steps there are, what Vibe says on
 * each, and which button is the step's one primary. Pure, so the rules are tested (test/onboarding.test.ts).
 */

/** Mac step 4: the offer, the guide while System Settings is open, then the shortcut is on. */
export type ShortcutOffer = 'offer' | 'waiting' | 'on';

/** Windows needs no permission, so it keeps three steps and names its shortcut on step 3. */
export function onboardingSteps(windows: boolean): string[] {
  return windows ? ['Hello', 'Try it', 'Your code'] : ['Hello', 'Try it', 'Your code', 'Shortcut'];
}

export interface OnboardingState {
  step: number;
  windows: boolean;
  /** The first word of the name typed on Hello, or ''. */
  firstName: string;
  /** The sample was sent to the panel (step 2). */
  explained: boolean;
  /** A paste or file went to the panel (step 3). */
  pasteStarted: boolean;
  /** The user's own code was explained. */
  ownCodeDone: boolean;
  offer: ShortcutOffer;
}

/**
 * What Vibe says, in 8 words or fewer (SPEC §3; Design Q10). The rest of each step's guidance is in the step itself:
 * the sample's note, the paste target's hint, the shortcut card.
 */
export function vibeLine(s: OnboardingState): string {
  if (s.step === 0) return "Hey! I'm Vibe. I explain your AI's code.";
  if (s.step === 1) {
    if (s.explained) return "That's me, explaining it in the panel.";
    return s.firstName ? `Nice to meet you, ${s.firstName}. Let's try one.` : "Let's do one for real.";
  }
  if (s.step === 2) {
    if (s.pasteStarted) return PASTE_STARTED_LINE;
    return s.windows && s.ownCodeDone ? 'That was your own code.' : 'Now try your own code.';
  }
  if (s.offer === 'on') return 'The shortcut is on. Try it anywhere.';
  return s.offer === 'waiting' ? "Switch Unvibe on. I'll notice by myself." : 'Want it one keystroke away next time?';
}

/** The line once a paste or file went to the panel, on setup's paste step and on the next open's. */
const PASTE_STARTED_LINE = 'Got it. Opening your explanation in the panel.';

/** The next open's paste step (OwnCodeWelcome), in the same 8 words or fewer. */
export function welcomeBackLine(pasteStarted: boolean): string {
  return pasteStarted ? PASTE_STARTED_LINE : 'Welcome back. Try it on your own code.';
}

export interface ForwardAction {
  label: string;
  /** Quiet: the step's primary is in its body (Explain this code, Turn on the shortcut) or there is none yet. */
  quiet?: boolean;
  /** Finishes setup instead of moving to the next step. */
  finishes?: boolean;
}

/**
 * The footer's one forward button. On the paste and shortcut steps, Skip for now, Not now and Do it later are quiet
 * and finish setup; before the sample is explained, Explain this code is the primary and Skip for now is quiet. Back on
 * a Mac's paste step after the own code is done, Next leads to the shortcut.
 */
export function forwardAction(s: OnboardingState): ForwardAction {
  const last = onboardingSteps(s.windows).length - 1;
  if (s.step === 0) return { label: "Let's go" };
  if (s.step === 1) return s.explained ? { label: 'Next' } : { label: 'Skip for now', quiet: true };
  if (s.step === 2 && s.ownCodeDone && s.step < last) return { label: 'Next' };
  if (s.step === 2 && !s.ownCodeDone) return { label: 'Skip for now', quiet: true, finishes: true };
  if (s.step === 3 && s.offer === 'offer') return { label: 'Not now', quiet: true, finishes: true };
  if (s.step === 3 && s.offer === 'waiting') return { label: 'Do it later', quiet: true, finishes: true };
  return { label: 'Start using Unvibe', finishes: true };
}

/** The step's own primary button, in its body, if it has one. */
export function stepAction(s: OnboardingState): string | null {
  if (s.step === 1 && !s.explained) return 'Explain this code';
  if (s.step === 3 && s.offer === 'offer') return 'Turn on the shortcut';
  return null;
}
