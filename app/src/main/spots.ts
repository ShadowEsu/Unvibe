/**
 * Where the person left the floating Island and the overlay, one spot per display (Vitalii via BOSS 636, Design 633:
 * "draggable, remembered per screen"). Pure geometry; windows.ts reads the displays and writes the settings.
 * A spot is the window's top-left corner in screen coordinates (for the Island, the compact pill's).
 */
export interface Spot { x: number; y: number }
export interface Box { x: number; y: number; width: number; height: number }
export type SpotsByDisplay = Partial<Record<string, Spot>>;

/** Every edge this far inside the work area, as the panel's own placement rule (fitPanelBounds) keeps it. */
export const SPOT_MARGIN = 12;
/** One arrow-key press on a focused header moves the window this far (Design 633). */
export const NUDGE_PX = 16;

/** A window of this size at this spot, moved the least so it sits fully inside the work area. */
export function clampSpot(spot: Spot, size: { width: number; height: number }, area: Box, margin = SPOT_MARGIN): Spot {
  const maxX = area.x + area.width - size.width - margin;
  const maxY = area.y + area.height - size.height - margin;
  return {
    x: Math.round(Math.max(area.x + margin, Math.min(spot.x, maxX))),
    y: Math.round(Math.max(area.y + margin, Math.min(spot.y, maxY))),
  };
}

/** Within this distance of the work area's margin line, a dropped window lands on it (edges feel magnetic). */
export const SNAP_PX = 18;

/** A dropped window near an edge of the work area lines up with that edge's margin. */
export function snapSpot(spot: Spot, size: { width: number; height: number }, area: Box, margin = SPOT_MARGIN): Spot {
  const left = area.x + margin;
  const right = area.x + area.width - margin - size.width;
  const top = area.y + margin;
  const bottom = area.y + area.height - margin - size.height;
  const x = Math.abs(spot.x - left) < SNAP_PX ? left : Math.abs(spot.x - right) < SNAP_PX ? right : spot.x;
  const y = Math.abs(spot.y - top) < SNAP_PX ? top : Math.abs(spot.y - bottom) < SNAP_PX ? bottom : spot.y;
  return { x, y };
}

/**
 * The spot saved for this display, kept inside its work area (Security A3: a saved spot never puts a window off every
 * screen). A spot saved for a display that is no longer attached is not used; the window falls back to its default.
 */
export function savedSpot(spots: SpotsByDisplay | undefined, displayId: number, size: { width: number; height: number }, area: Box): Spot | null {
  const spot = spots?.[String(displayId)];
  if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) return null;
  return clampSpot(spot, size, area);
}

/** The spots with this display's spot replaced (or removed with `null`); other displays keep theirs. */
export function withSpot(spots: SpotsByDisplay | undefined, displayId: number, spot: Spot | null): SpotsByDisplay {
  const next: SpotsByDisplay = { ...spots };
  if (spot) next[String(displayId)] = { x: Math.round(spot.x), y: Math.round(spot.y) };
  else delete next[String(displayId)];
  return next;
}

/**
 * The floating Island's window when its pill sits at `pill`. The pill stays where the person left it: the expanded
 * card (or a notice) grows from it toward the middle of the screen, so it opens upward from the lower half of the
 * work area and downward from the upper half, keeping the pill's horizontal centre where it fits.
 */
export function islandWindowAt(pill: Spot, pillSize: { width: number; height: number }, size: { width: number; height: number }, area: Box): Box & { opensUp: boolean } {
  const opensUp = pill.y + pillSize.height / 2 > area.y + area.height / 2;
  const x = pill.x + Math.round((pillSize.width - size.width) / 2);
  const y = opensUp ? pill.y + pillSize.height - size.height : pill.y;
  return { ...clampSpot({ x, y }, size, area), width: size.width, height: size.height, opensUp };
}

/** Where the pill is inside an Island window that opens up or down (the inverse of islandWindowAt, before clamping). */
export function pillSpotIn(win: Box, pillSize: { width: number; height: number }, opensUp: boolean): Spot {
  return {
    x: win.x + Math.round((win.width - pillSize.width) / 2),
    y: opensUp ? win.y + win.height - pillSize.height : win.y,
  };
}
