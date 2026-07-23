export type WidgetResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const WIDGET_MIN_W = 280;
export const WIDGET_MIN_H = 240;
export const DEFAULT_WIDGET_W = 300;
export const DEFAULT_WIDGET_H = 360;
export const SNAP_THRESHOLD = 18;

export function applyWidgetResize(
  start: Electron.Rectangle,
  edge: WidgetResizeEdge,
  dx: number,
  dy: number,
): Electron.Rectangle {
  let { x, y, width, height } = start;
  if (edge.includes('e')) width = Math.max(WIDGET_MIN_W, start.width + dx);
  if (edge.includes('s')) height = Math.max(WIDGET_MIN_H, start.height + dy);
  if (edge.includes('w')) {
    width = Math.max(WIDGET_MIN_W, start.width - dx);
    x = start.x + (start.width - width);
  }
  if (edge.includes('n')) {
    height = Math.max(WIDGET_MIN_H, start.height - dy);
    y = start.y + (start.height - height);
  }
  return { x, y, width, height };
}

export interface DisplayGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clampToVisibleArea(
  bounds: Electron.Rectangle,
  displays: DisplayGeometry[],
  primaryDisplay: DisplayGeometry,
): Electron.Rectangle {
  const visible = displays.find(({ x, y, width, height }) =>
    bounds.x < x + width && bounds.x + bounds.width > x &&
    bounds.y < y + height && bounds.y + bounds.height > y,
  );
  const workArea = visible ?? primaryDisplay;
  const w = Math.min(bounds.width, workArea.width - 24);
  const h = Math.min(bounds.height, workArea.height - 24);
  return {
    width: w,
    height: h,
    x: Math.min(Math.max(bounds.x, workArea.x + 12), workArea.x + workArea.width - w - 12),
    y: Math.min(Math.max(bounds.y, workArea.y + 12), workArea.y + workArea.height - h - 12),
  };
}

export function snapWidget(
  bounds: Electron.Rectangle,
  display: DisplayGeometry,
): Electron.Rectangle {
  let { x, y } = bounds;
  if (Math.abs(x - display.x) < SNAP_THRESHOLD) x = display.x;
  if (Math.abs(x + bounds.width - (display.x + display.width)) < SNAP_THRESHOLD) x = display.x + display.width - bounds.width;
  if (Math.abs(y - display.y) < SNAP_THRESHOLD) y = display.y;
  if (Math.abs(y + bounds.height - (display.y + display.height)) < SNAP_THRESHOLD) y = display.y + display.height - bounds.height;
  if (x !== bounds.x || y !== bounds.y) return { x, y, width: bounds.width, height: bounds.height };
  return bounds;
}

export function isStockOldBounds(bounds: { width: number; height: number }): boolean {
  return (
    (bounds.width === 440 && bounds.height === 560) ||
    (bounds.width === 360 && bounds.height === 480) ||
    (bounds.width === 340 && bounds.height === 440)
  );
}

export function resolveWidgetBounds(
  saved: Electron.Rectangle | undefined,
  cursorPoint: { x: number; y: number },
  display: DisplayGeometry,
): Electron.Rectangle {
  if (!saved) {
    return {
      width: DEFAULT_WIDGET_W,
      height: DEFAULT_WIDGET_H,
      x: Math.min(Math.max(cursorPoint.x + 24, display.x), display.x + display.width - DEFAULT_WIDGET_W - 12),
      y: Math.min(Math.max(cursorPoint.y - 40, display.y), display.y + display.height - DEFAULT_WIDGET_H - 12),
    };
  }
  if (isStockOldBounds(saved)) {
    return { x: saved.x, y: saved.y, width: DEFAULT_WIDGET_W, height: DEFAULT_WIDGET_H };
  }
  return { ...saved };
}
