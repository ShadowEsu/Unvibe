/**
 * Clicking away (Design ruling e, Fade): when the panel loses focus main says so (panel:away) and the pane drops to
 * 22 % over 200 ms. It stays clickable: a click, a 150 ms hover or ⌃U (which focuses it) brings it back to 100 % in
 * 150 ms. Hide is main's (the window closes and keeps its state). Reduced motion: the opacity changes at once.
 */
export const FADE_OPACITY = 0.22;
export const FADE_OUT_MS = 200;
export const FADE_IN_MS = 150;
/** How long the pointer rests on a faded pane before it comes back. */
export const HOVER_WAKE_MS = 150;

/** `away`: main reported the focus gone; `woken`: a press or a long-enough hover brought it back meanwhile. */
export interface FadeState {
  away: boolean;
  woken: boolean;
}

export type FadeEvent = 'away' | 'back' | 'press' | 'hoverWake' | 'leave';

export const NOT_FADED: FadeState = { away: false, woken: false };

export function nextFade(state: FadeState, event: FadeEvent): FadeState {
  switch (event) {
    case 'away': return { away: true, woken: false };
    case 'back': return NOT_FADED;
    // A press or a rested pointer wakes a faded pane; leaving it (still unfocused) lets it fade again.
    case 'press':
    case 'hoverWake': return state.away ? { away: true, woken: true } : state;
    case 'leave': return state.away ? { away: true, woken: false } : state;
  }
}

export function fadeStyle(state: FadeState, reducedMotion: boolean): { opacity: number; transitionMs: number } {
  const faded = state.away && !state.woken;
  return { opacity: faded ? FADE_OPACITY : 1, transitionMs: reducedMotion ? 0 : faded ? FADE_OUT_MS : FADE_IN_MS };
}
