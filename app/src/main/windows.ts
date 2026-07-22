import { BrowserWindow, screen, shell } from 'electron';
import path from 'node:path';
import { settings, type BarPosition } from './settings';

const preload = () => path.join(__dirname, '../preload/preload.cjs');
const page = (name: string) => path.join(__dirname, `../renderer/${name}/${name}.html`);

const SNAP = 18;
/** Compact AI Container — small enough not to intimidate on first open. */
const DEFAULT_WIDGET_W = 300;
const DEFAULT_WIDGET_H = 360;
/** One shared review panel — ⌘U reuses this instead of stacking windows. */
let panelWin: BrowserWindow | null = null;
let barIsExpanded = false;

const secureWebPrefs = () => ({
  preload: preload(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
});

/** Renderers are local files; deny any attempt to open new windows or navigate away. */
function lockNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) || /^mailto:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function barBounds(position: BarPosition, w: number, h: number): { x: number; y: number } {
  const pointer = screen.getCursorScreenPoint();
  const display = settings().all().followActiveDisplay
    ? screen.getDisplayNearestPoint(pointer)
    : screen.getPrimaryDisplay();
  const { workArea } = display;
  const cx = workArea.x + Math.round((workArea.width - w) / 2);
  const right = workArea.x + workArea.width - w - 12;
  // Top-center is the attached Island position; the other top placement keeps
  // a small floating inset so the two modes remain visually distinct.
  const top = position === 'top-center' ? workArea.y : workArea.y + 12;
  const bottom = workArea.y + workArea.height - h - 12;
  switch (position) {
    case 'top-center':
      return { x: cx, y: top };
    case 'top-right':
      return { x: right, y: top };
    case 'bottom-right':
      return { x: right, y: bottom };
    default:
      return { x: cx, y: bottom };
  }
}

/** Compact landscape aisle: play · logo · home. */
const BAR_W = 196;
const BAR_H = 44;
const BAR_EXPANDED_W = 410;
// The drawer contains recent learning, stats, and two actions. Keep transparent
// window chrome larger than its visual card so no interactive content is clipped.
const BAR_EXPANDED_H = 194;

export function createBar(): BrowserWindow {
  barIsExpanded = false;
  const { x, y } = barBounds(settings().all().barPosition, BAR_W, BAR_H);
  const win = new BrowserWindow({
    width: BAR_W,
    height: BAR_H,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: secureWebPrefs(),
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setHiddenInMissionControl(true);
  win.setFullScreenable(false);
  lockNavigation(win);
  void win.loadFile(page('bar'));
  return win;
}

/** Hover expansion is a real window resize so the transparent area never blocks other apps. */
export function resizeBar(win: BrowserWindow | null, expanded: boolean): void {
  if (!win || win.isDestroyed()) return;
  if (barIsExpanded === expanded) return;
  barIsExpanded = expanded;
  const width = expanded ? BAR_EXPANDED_W : BAR_W;
  const height = expanded ? BAR_EXPANDED_H : BAR_H;
  const { x, y } = barBounds(settings().all().barPosition, width, height);
  win.setFocusable(expanded);
  win.setBounds({ x, y, width, height }, process.platform === 'darwin');
  win.moveTop();
}

/** Move the bar to a new position (called when the setting changes). */
export function positionBar(win: BrowserWindow): void {
  const b = win.getBounds();
  const { x, y } = barBounds(settings().all().barPosition, b.width, b.height);
  win.setBounds({ ...b, x, y });
}

/** Quiet aisle — only show while a review is active. */
export function showBar(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  positionBar(win);
  if (!win.isVisible()) win.showInactive();
  win.moveTop();
}

export function hideBar(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  win.hide();
}

function snap(win: BrowserWindow): void {
  const b = win.getBounds();
  const { workArea: wa } = screen.getDisplayNearestPoint({ x: b.x, y: b.y });
  let { x, y } = b;
  if (Math.abs(x - wa.x) < SNAP) x = wa.x;
  if (Math.abs(x + b.width - (wa.x + wa.width)) < SNAP) x = wa.x + wa.width - b.width;
  if (Math.abs(y - wa.y) < SNAP) y = wa.y;
  if (Math.abs(y + b.height - (wa.y + wa.height)) < SNAP) y = wa.y + wa.height - b.height;
  if (x !== b.x || y !== b.y) win.setBounds({ x, y, width: b.width, height: b.height });
}

function clampToVisibleArea(bounds: Electron.Rectangle): Electron.Rectangle {
  const displays = screen.getAllDisplays();
  const visible = displays.find(({ workArea }) =>
    bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x &&
    bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y,
  );
  const workArea = (visible ?? screen.getPrimaryDisplay()).workArea;
  const width = Math.min(bounds.width, workArea.width - 24);
  const height = Math.min(bounds.height, workArea.height - 24);
  return {
    width,
    height,
    x: Math.min(Math.max(bounds.x, workArea.x + 12), workArea.x + workArea.width - width - 12),
    y: Math.min(Math.max(bounds.y, workArea.y + 12), workArea.y + workArea.height - height - 12),
  };
}

function defaultWidgetBounds(): Electron.Rectangle {
  const cursor = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  const w = DEFAULT_WIDGET_W;
  const h = DEFAULT_WIDGET_H;
  return {
    width: w,
    height: h,
    x: Math.min(Math.max(cursor.x + 24, workArea.x), workArea.x + workArea.width - w - 12),
    y: Math.min(Math.max(cursor.y - 40, workArea.y), workArea.y + workArea.height - h - 12),
  };
}

/** Restore user size/position, but migrate the old stock 440×560 default to the shorter panel. */
function resolveWidgetBounds(): Electron.Rectangle {
  const saved = settings().all().lastWidgetBounds;
  if (!saved) return defaultWidgetBounds();
  const stockOld =
    (saved.width === 440 && saved.height === 560) ||
    (saved.width === 360 && saved.height === 480) ||
    (saved.width === 340 && saved.height === 440);
  if (stockOld) {
    return { ...saved, width: DEFAULT_WIDGET_W, height: DEFAULT_WIDGET_H };
  }
  return { ...saved };
}

/** Edges for border-aligned custom resize (OS chrome resize is disabled — too far from the visible card). */
export type WidgetResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const WIDGET_MIN_W = 280;
const WIDGET_MIN_H = 240;

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

function buildWidgetWindow(bounds: Electron.Rectangle): BrowserWindow {
  const win = new BrowserWindow({
    ...clampToVisibleArea(bounds),
    minWidth: WIDGET_MIN_W,
    minHeight: WIDGET_MIN_H,
    frame: false,
    transparent: true,
    // System resize hits a thick invisible rim outside the card. Resize is handled
    // from the visible border grips in the renderer instead.
    resizable: false,
    hasShadow: false,
    roundedCorners: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: secureWebPrefs(),
  });
  // pop-up-menu sits above normal windows while still behaving like an auxiliary tool panel.
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setHiddenInMissionControl(true);
  win.setFullScreenable(false);

  const persist = () => {
    if (win.isDestroyed()) return;
    settings().set({ lastWidgetBounds: win.getBounds() });
  };
  win.on('moved', () => {
    snap(win);
    persist();
  });
  win.on('resized', persist);

  win.on('blur', () => {
    if (win.isDestroyed()) return;
    const behavior = settings().all().inactiveBehavior;
    if (behavior === 'dim') win.setOpacity(settings().all().widgetOpacityInactive);
    if (behavior === 'collapse') win.webContents.send('widget:autocollapse', true);
  });
  win.on('focus', () => {
    if (win.isDestroyed()) return;
    win.setOpacity(1);
    if (settings().all().inactiveBehavior === 'collapse') {
      win.webContents.send('widget:autocollapse', false);
    }
  });

  lockNavigation(win);
  win.once('ready-to-show', () => win.showInactive());
  void win.loadFile(page('widget'));
  return win;
}

/** Prefer the existing review panel; create only when needed. */
export function getOrCreateWidget(): BrowserWindow {
  if (panelWin && !panelWin.isDestroyed()) {
    if (panelWin.isMinimized()) panelWin.restore();
    panelWin.showInactive();
    panelWin.focus();
    return panelWin;
  }
  panelWin = buildWidgetWindow(resolveWidgetBounds());
  panelWin.on('closed', () => {
    panelWin = null;
  });
  return panelWin;
}

/** @deprecated use getOrCreateWidget — kept for any stray callers */
export function createWidget(): BrowserWindow {
  return getOrCreateWidget();
}

export function currentWidget(): BrowserWindow | null {
  return panelWin && !panelWin.isDestroyed() ? panelWin : null;
}

export function createCompanion(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 620,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#faf7f0',
    skipTaskbar: false,
    webPreferences: secureWebPrefs(),
  });
  lockNavigation(win);
  // Setup is intentionally a full-window moment. Once it is complete, future
  // launches retain the normal companion size so the app stays out of the way.
  if (!settings().all().onboarded) win.maximize();
  void win.loadFile(page('companion'));
  return win;
}
