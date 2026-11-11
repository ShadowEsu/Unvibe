/**
 * Rasterises the Unvibe ghost (the Buddy body path and its two eyes, shared/buddy.tsx) into a grid of
 * text cells, so the ASCII ghost is the real logo silhouette and not a redrawing of it.
 * Each cell gets its body coverage (0–1, supersampled), eye coverage, and its position in the ghost's own
 * box (u, v in 0–1) for shading. No dependency on the vendored engine: the ghost is Unvibe's own species.
 */

/** The Buddy body (viewBox 0 0 48 48). */
export const GHOST_BODY = 'M24 8C33 8 38.5 14 40 22.5C41.5 31 43 38 37.5 41C32 43.6 16 43.6 10.5 41C5 38 6.5 31 8 22.5C9.5 14 15 8 24 8Z';
/** The open eyes: iris ellipses (cx, cy, rx, ry) in the same box. */
export const GHOST_EYES: ReadonlyArray<readonly [number, number, number, number]> = [
  [18.6, 24.2, 3.3, 4.6],
  [29.4, 24.2, 3.3, 4.6],
];
/** Where the body sits in its 48-unit box: x 8–40, y 8–43.6. */
export const GHOST_BOX = { x: 8, y: 8, w: 32, h: 35.6 } as const;

export interface GhostCell {
  col: number;
  row: number;
  /** Body coverage 0–1. */
  cover: number;
  /** Eye coverage 0–1 (subset of the body). */
  eye: number;
  /** Position inside the ghost box, 0–1 each. */
  u: number;
  v: number;
}

export interface GhostMask {
  cols: number;
  rows: number;
  cells: GhostCell[];
  /** The box the ghost occupies in cells. */
  left: number;
  top: number;
  width: number;
  height: number;
}

const SUPER = 4;

/**
 * @param cellW  cell width in CSS px (one mono glyph)
 * @param cellH  cell height in CSS px (line height)
 * @param height ghost height in CSS px (the body, eyes included)
 * @param cols   grid width in cells; the ghost is centred in it
 * @param rows   grid height in cells
 */
export function buildGhostMask(cellW: number, cellH: number, height: number, cols: number, rows: number, minCover = 0.22): GhostMask {
  const scale = height / GHOST_BOX.h;
  const widthPx = GHOST_BOX.w * scale;
  const width = Math.ceil(widthPx / cellW);
  const ghostRows = Math.ceil(height / cellH);
  const left = Math.floor((cols - width) / 2);
  const top = Math.floor((rows - ghostRows) / 2);
  const pw = width * SUPER;
  const ph = ghostRows * SUPER;

  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return { cols, rows, cells: [], left, top, width, height: ghostRows };
  // Supersampled pixels per CSS px, independently per axis (cells are not square).
  const sx = SUPER / cellW;
  const sy = SUPER / cellH;
  const offX = (width * cellW - widthPx) / 2;
  const offY = (ghostRows * cellH - height) / 2;
  const body = new Path2D(GHOST_BODY);
  const paint = (channel: 'body' | 'eyes') => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, pw, ph);
    g.setTransform(sx * scale, 0, 0, sy * scale, offX * sx - GHOST_BOX.x * scale * sx, offY * sy - GHOST_BOX.y * scale * sy);
    g.fillStyle = '#fff';
    if (channel === 'body') {
      g.fill(body);
    } else {
      for (const [cx, cy, rx, ry] of GHOST_EYES) {
        g.beginPath();
        g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    return g.getImageData(0, 0, pw, ph).data;
  };
  const bodyPx = paint('body');
  const eyePx = paint('eyes');
  const cells: GhostCell[] = [];
  const per = SUPER * SUPER * 255;
  for (let r = 0; r < ghostRows; r++) {
    for (let c = 0; c < width; c++) {
      let b = 0;
      let e = 0;
      for (let y = 0; y < SUPER; y++) {
        const rowBase = ((r * SUPER + y) * pw + c * SUPER) * 4 + 3;
        for (let x = 0; x < SUPER; x++) {
          b += bodyPx[rowBase + x * 4];
          e += eyePx[rowBase + x * 4];
        }
      }
      const cover = b / per;
      if (cover < minCover) continue;
      cells.push({
        col: left + c,
        row: top + r,
        cover,
        eye: e / per,
        u: ((c + 0.5) * cellW - offX) / widthPx,
        v: ((r + 0.5) * cellH - offY) / height,
      });
    }
  }
  return { cols, rows, cells, left, top, width, height: ghostRows };
}
