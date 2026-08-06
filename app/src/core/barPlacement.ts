export type BarPlacementAction = 'none' | 'reposition' | 'reset-and-reposition';

export interface BarPlacementPatch {
  barPosition?: unknown;
  followActiveDisplay?: unknown;
  /** Any other settings field — never influences strip placement. */
  [key: string]: unknown;
}

/**
 * Decide what the learning strip must do after a settings patch.
 *
 * - A `barPosition` change requires resetting the strip to its compact width
 *   for the new placement before repositioning.
 * - A `followActiveDisplay` change (ON or OFF) only needs repositioning: the
 *   new value selects the display used by `barBounds`.
 * - Any other patch needs no strip movement.
 */
export function barPlacementAction(patch: BarPlacementPatch): BarPlacementAction {
  if (patch.barPosition !== undefined) return 'reset-and-reposition';
  if (patch.followActiveDisplay !== undefined) return 'reposition';
  return 'none';
}
