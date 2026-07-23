import { BrowserWindow, screen, shell } from 'electron';
import process from 'node:process';
import path from 'node:path';
import { settings, type BarPosition } from './settings';
import {
  clampToVisibleArea,
  resolveWidgetBounds,
  snapWidget,
  WIDGET_MIN_W,
  WIDGET_MIN_H,
} from './windowGeometry';
export { applyWidgetResize, type WidgetResizeEdge } from './windowGeometry';

const preload = () => path.join(__dirname, '../preload/preload.cjs');
const page = (name: string) => path.join(__dirname, `../renderer/${name}/${name}.html`);

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
  const { workArea, bounds } = display;
  const centerArea = position === 'top-center' ? bounds : workArea;
  const cx = centerArea.x + Math.round((centerArea.width - w) / 2);
  const right = workArea.x + workArea.width - w - 12;
  // Top-center is the attached Island position; the other top placement keeps
  // a small floating inset so the two modes remain visually distinct.
  const top = position === 'top-center' ? bounds.y : workArea.y + 12;
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
const TOP_BAR_W = 340;
const FLOATING_BAR_W = 196;
const BOTTOM_BAR_W = 48;
const BAR_H = 44;
const BAR_EXPANDED_W = 620;
// The drawer contains recent learning, stats, and two actions. Keep transparent
// window chrome larger than its visual card so no interactive content is clipped.
const BAR_EXPANDED_H = 368;

function compactBarWidth(position: BarPosition): number {
  if (position === 'top-center') return TOP_BAR_W;
  if (position.startsWith('bottom')) return BOTTOM_BAR_W;
  return FLOATING_BAR_W;
}

export function createBar(): BrowserWindow {
  barIsExpanded = false;
  const compactWidth = compactBarWidth(settings().all().barPosition);
  const { x, y } = barBounds(settings().all().barPosition, compactWidth, BAR_H);
  const win = new BrowserWindow({
    width: compactWidth,
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
  // macOS behavior unverified on Linux runner
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (process.platform === 'darwin') {
    win.setHiddenInMissionControl(true);
    win.setFullScreenable(false);
  }
  lockNavigation(win);
  void win.loadFile(page('bar'));
  return win;
}

/** Hover expansion is a real window resize so the transparent area never blocks other apps. */
export function resizeBar(win: BrowserWindow | null, expanded: boolean, force = false): void {
  if (!win || win.isDestroyed()) return;
  if (barIsExpanded === expanded && !force) return;
  barIsExpanded = expanded;
  const position = settings().all().barPosition;
  const bottom = position.startsWith('bottom');
  const width = expanded ? (bottom ? 152 : BAR_EXPANDED_W) : compactBarWidth(position);
  const height = expanded ? (bottom ? 48 : BAR_EXPANDED_H) : BAR_H;
  const { x, y } = barBounds(position, width, height);
  win.setFocusable(expanded);
  // CSS owns the visual peel/fold. Native macOS bounds animation fighting it
  // produced the visible jump captured in the interaction recording.
  win.setBounds({ x, y, width, height }, false);
  win.moveTop();
}

/** Move the bar to a new position (called when the setting changes). */
export function positionBar(win: BrowserWindow): void {
  const b = win.getBounds();
  const position = settings().all().barPosition;
  const width = barIsExpanded ? b.width : compactBarWidth(position);
  const { x, y } = barBounds(position, width, b.height);
  win.setBounds({ ...b, width, x, y });
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

function snapWidgetWindow(win: BrowserWindow): void {
  const b = win.getBounds();
  const { workArea: wa } = screen.getDisplayNearestPoint({ x: b.x, y: b.y });
  const next = snapWidget(b, { x: wa.x, y: wa.y, width: wa.width, height: wa.height });
  if (next.x !== b.x || next.y !== b.y) win.setBounds(next);
}

function readWidgetBounds(): Electron.Rectangle {
  const saved = settings().all().lastWidgetBounds;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  return resolveWidgetBounds(saved, { x: cursor.x, y: cursor.y }, {
    x: display.workArea.x,
    y: display.workArea.y,
    width: display.workArea.width,
    height: display.workArea.height,
  });
}

function buildWidgetWindow(bounds: Electron.Rectangle): BrowserWindow {
  const displayBounds = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea;
  const clamped = clampToVisibleArea(bounds, screen.getAllDisplays().map((d) => d.workArea), {
    x: displayBounds.x,
    y: displayBounds.y,
    width: displayBounds.width,
    height: displayBounds.height,
  });
  const win = new BrowserWindow({
    ...clamped,
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
  // macOS behavior unverified on Linux runner
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (process.platform === 'darwin') {
    win.setHiddenInMissionControl(true);
    win.setFullScreenable(false);
  }

  const persist = () => {
    if (win.isDestroyed()) return;
    settings().set({ lastWidgetBounds: win.getBounds() });
  };
  win.on('moved', () => {
    snapWidgetWindow(win);
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
  panelWin = buildWidgetWindow(readWidgetBounds());
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
