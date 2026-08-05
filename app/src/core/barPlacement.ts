/**
 * Bar placement decisions, extracted into a pure module so the cross-platform
 * rules are testable without Electron. The learning strip follows the display
 * under the pointer when `followActiveDisplay` is on; toggling that setting OFF
 * must reposition the bar to the primary display, so the decision triggers on
 * `!== undefined` (a real toggle), not on truthiness.
 */

export type BarPlacementAction =
  /** No placement-relevant field changed — leave the bar alone. */
  | { kind: 'none' }
  /** `barPosition` changed — collapse, then place at the new corner. */
  | { kind: 'reset-and-reposition' }
  /** `followActiveDisplay` toggled on or off — move the bar to the correct display. */
  | { kind: 'reposition' };

/** Placement-relevant fields of a settings patch. Extra fields are ignored. */
export type BarPlacementPatch = {
  barPosition?: unknown;
  followActiveDisplay?: boolean;
  [key: string]: unknown;
};

export function barPlacementAction(patch: BarPlacementPatch): BarPlacementAction {
  if (patch.barPosition !== undefined) return { kind: 'reset-and-reposition' };
  if (patch.followActiveDisplay !== undefined) return { kind: 'reposition' };
  return { kind: 'none' };
}
