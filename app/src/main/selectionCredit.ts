import { notify, pulseBar } from './notify';
import { store } from './store';
import { fullProductBuildEnabled, trialBuildEnabled } from './trial';

/** 'held': a trial build took one local selected-code credit; 'free': this build doesn't count them. */
export type SelectionCredit = 'held' | 'free';

/**
 * Trial builds count selected-code prompts on this computer. Null once they're used up: the notice says so, and the
 * Island leaves the working word the shortcut started ("Loading") with the explanation limit's error pulse, which it
 * shows as "Issue" (bar.tsx; it used to stay on its working word; polish backlog P3).
 */
export function takeSelectionCredit(counted = trialBuildEnabled() && !fullProductBuildEnabled()): SelectionCredit | null {
  if (!counted) return 'free';
  if (store().consumeBetaSelectedCodePrompt().ok) return 'held';
  notify(`Your 30-day beta includes ${store().betaSelectedCodeUsage().limit} selected-code prompts. Your saved learning is still available.`, { problem: true });
  pulseBar({ phase: 'error', label: 'Limit reached' });
  return null;
}
