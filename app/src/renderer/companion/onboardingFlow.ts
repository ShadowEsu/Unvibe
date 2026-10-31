import { NOT_NOW } from './names';

/**
 * First-run setup gives before it asks (Design A10, polish bar B-2): the real sample explanation
 * comes first, and the name question and the optional Google sync come after it. On a Mac, the
 * own-code paste step needs no permission and the shortcut (Accessibility) is offered last, once
 * that worked. Windows needs no permission, so it ends on "select code anywhere".
 */
export type SetupStep = 'try' | 'you' | 'code' | 'shortcut' | 'anywhere';

export function setupSteps(windows: boolean): SetupStep[] {
  return windows ? ['try', 'you', 'anywhere'] : ['try', 'you', 'code', 'shortcut'];
}

export const SETUP_STEP_LABELS: Record<SetupStep, string> = {
  try: 'Try it', you: 'You', code: 'Your code', shortcut: 'Shortcut', anywhere: 'Anywhere',
};

export interface SetupForward {
  label: string;
  /** Outlined like every skip, so it never outweighs the step's own primary (Design P12). */
  ghost: boolean;
  /** Finishes setup instead of moving to the next step. */
  finishes: boolean;
}

/** The footer's right-hand button for a step. A skip is always "Not now" and always outlined. */
export function setupForward(step: SetupStep, state: { explained: boolean; ownCodeDone: boolean; shortcutOn: boolean }): SetupForward {
  switch (step) {
    case 'try':
      return state.explained ? { label: 'Next', ghost: false, finishes: false } : { label: NOT_NOW, ghost: true, finishes: false };
    case 'you':
      return { label: 'Next', ghost: false, finishes: false };
    case 'code':
      return state.ownCodeDone ? { label: 'Next', ghost: true, finishes: false } : { label: NOT_NOW, ghost: true, finishes: true };
    case 'shortcut':
      return state.shortcutOn ? { label: 'Start using Unvibe', ghost: false, finishes: true } : { label: NOT_NOW, ghost: true, finishes: true };
    case 'anywhere':
      return { label: 'Start using Unvibe', ghost: false, finishes: true };
  }
}
