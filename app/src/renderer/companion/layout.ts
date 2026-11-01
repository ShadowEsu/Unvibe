/**
 * Layout rules for the companion's bottom edge (Design audit A7, P2 and P4): nothing sits on top
 * of page content.
 */

/** Space between the end of a page and the Ask bar, in px. */
export const ASK_BAR_GAP = 16;

/**
 * Bottom padding of a scroll area above the Ask bar: the bar's height plus 16 px, so the last card
 * or legend can always scroll clear of it. Pages without the bar (Ask Vibe) pass 0 and keep the gap.
 */
export function scrollEndPadding(askBarHeight: number): number {
  return Math.ceil(Math.max(0, askBarHeight)) + ASK_BAR_GAP;
}

/**
 * The bottom-right slot holds one thing at a time: the update card when an update is waiting,
 * otherwise Vibe. Ask Vibe has Vibe on the page itself and Settings covers the window, so the slot
 * is empty there unless an update is waiting.
 */
export function bottomRightSlot(state: { updateShown: boolean; page: string; settingsOpen: boolean }): 'update' | 'vibe' | null {
  if (state.updateShown) return 'update';
  if (state.page === 'Chat' || state.settingsOpen) return null;
  return 'vibe';
}
