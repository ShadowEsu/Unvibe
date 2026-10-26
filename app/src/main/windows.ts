import { BrowserWindow, screen, shell, type WebContents } from 'electron';
import path from 'node:path';
import { settings, type BarPosition, type BarSize } from './settings';
import { isSafeExternalUrl } from '../core/permissions';

const preload = () => path.join(__dirname, '../preload/preload.cjs');
const page = (name: string) => path.join(__dirname, `../renderer/${name}/${name}.html`);

const SNAP = 18;
/** Opening size for the review panel. Big enough to read, not a full window. */
const DEFAULT_WIDGET_W = 560;
const DEFAULT_WIDGET_H = 640;
/** One shared review panel — ⌘U reuses this instead of stacking windows. */
let panelWin: BrowserWindow | null = null;
let barIsExpanded = false;
let limitPauseActive = false;

const secureWebPrefs = () => ({
  preload: preload(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
});

/** Renderers are local files; deny any attempt to open new windows or navigate away. */
function lockNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

/**
 * Only macOS attaches the top Island to the screen edge around the camera notch. Elsewhere
 * 'top-center' is a floating pill below the top of the work area, like the other positions.
 */
function attachedIsland(position: BarPosition): boolean {
  return position === 'top-center' && process.platform === 'darwin';
}

function barBounds(position: BarPosition, w: number, h: number): { x: number; y: number } {
  const pointer = screen.getCursorScreenPoint();
  const display = settings().all().followActiveDisplay
    ? screen.getDisplayNearestPoint(pointer)
    : screen.getPrimaryDisplay();
  const { workArea, bounds } = display;
  const attached = attachedIsland(position);
  const centerArea = attached ? bounds : workArea;
  const cx = centerArea.x + Math.round((centerArea.width - w) / 2);
  const right = workArea.x + workArea.width - w - 12;
  // Keep every interactive pixel below the macOS camera/menu-bar safe area.
  const top = attached ? bounds.y : workArea.y + 12;
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

/** Compact top surface. Width leaves independent controls on both sides of a Mac notch. */
const FLOATING_BAR_W = 184;
const BOTTOM_BAR_COMPACT_W = 184;
/** Floating (not attached) bars open into a card this wide, above or below the pill. */
const FLOATING_EXPANDED_W = 372;
/** Height of the expanded overview under (or above) the compact row. Fits note + actions. */
const BAR_EXPANDED_BODY_H = 244;
const FLOATING_ROW_H = 38;

function islandMetrics(): { w: number; h: number } {
  const size: BarSize = settings().all().barSize ?? 'medium';
  // The built-in 14-inch M4 screen reports a 185-point camera housing through
  // NSScreen's auxiliary top areas. The renderer reserves 193 points for it.
  if (size === 'small') return { w: 402, h: 38 };
  if (size === 'large') return { w: 466, h: 39 };
  return { w: 432, h: 38 };
}

function compactBarWidth(position: BarPosition): number {
  if (attachedIsland(position)) return islandMetrics().w;
  if (position.startsWith('bottom')) return BOTTOM_BAR_COMPACT_W;
  return FLOATING_BAR_W;
}

/** The black cap attaches to the screen; controls start below the camera safe area. */
function islandSafeTop(position: BarPosition): number {
  if (!attachedIsland(position)) return 0;
  const display = settings().all().followActiveDisplay
    ? screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) : screen.getPrimaryDisplay();
  return Math.max(process.platform === 'darwin' ? 38 : 0, display.workArea.y - display.bounds.y);
}

function compactBarHeight(position: BarPosition): number {
  return attachedIsland(position) ? Math.max(islandMetrics().h, islandSafeTop(position)) : FLOATING_ROW_H;
}

function barSize(position: BarPosition, expanded: boolean): { width: number; height: number } {
  if (!expanded) return { width: compactBarWidth(position), height: compactBarHeight(position) };
  if (attachedIsland(position)) return { width: compactBarWidth(position), height: BAR_EXPANDED_BODY_H + islandSafeTop(position) };
  return { width: FLOATING_EXPANDED_W, height: BAR_EXPANDED_BODY_H + FLOATING_ROW_H };
}

export function createBar(): BrowserWindow {
  barIsExpanded = false;
  const position = settings().all().barPosition;
  const compactWidth = compactBarWidth(position);
  const compactHeight = compactBarHeight(position);
  const { x, y } = barBounds(position, compactWidth, compactHeight);
  const win = new BrowserWindow({
    width: compactWidth,
    height: compactHeight,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: !attachedIsland(position),
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    fullscreenable: false,
    enableLargerThanScreen: true,
    roundedCorners: false,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    show: false,
    webPreferences: secureWebPrefs(),
  });
  win.setAlwaysOnTop(true, 'screen-saver', 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  if (process.platform === 'darwin') win.setHiddenInMissionControl(true);
  win.setFullScreenable(false);
  if (process.platform === 'darwin') win.setWindowButtonVisibility(false);
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
  const { width, height } = barSize(position, expanded);
  const { x, y } = barBounds(position, width, height);
  // Hover previews must never activate the app or interrupt typing in the editor.
  win.setFocusable(false);
  const prev = win.getBounds();
  if (force || prev.x !== x || prev.y !== y || prev.width !== width || prev.height !== height) {
    win.setBounds({ x, y, width, height }, true);
  }
  win.moveTop();
}

/** Move the bar to a new position (called when the setting changes). */
export function positionBar(win: BrowserWindow): void {
  const position = settings().all().barPosition;
  const { width, height } = barSize(position, barIsExpanded);
  win.setMovable(!attachedIsland(position));
  const { x, y } = barBounds(position, width, height);
  win.setBounds({ x, y, width, height });
  if (attachedIsland(position)) win.setPosition(x, y);
}

/** Quiet aisle — only show while a review is active. */
export function showBar(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  // macOS can lower an auxiliary window while an editor enters a full-screen
  // Space. Reassert both flags whenever the Island is shown.
  win.setAlwaysOnTop(true, 'screen-saver', 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
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

/** Restore user size/position. Stock tiny panels get the current opening size. */
function resolveWidgetBounds(): Electron.Rectangle {
  const saved = settings().all().lastWidgetBounds;
  if (!saved) return defaultWidgetBounds();
  const stockTiny =
    (saved.width === 300 && saved.height === 360) ||
    (saved.width === 280 && saved.height === 240) ||
    (saved.width === 340 && saved.height === 440) ||
    (saved.width === 360 && saved.height === 480) ||
    (saved.width === 440 && saved.height === 560) ||
    (saved.width === 480 && saved.height === 600) ||
    (saved.width === 540 && saved.height === 720) ||
    (saved.width === 680 && saved.height === 720);
  if (stockTiny) {
    return { ...saved, width: DEFAULT_WIDGET_W, height: DEFAULT_WIDGET_H };
  }
  return { ...saved };
}

/** Edges for border-aligned custom resize (OS chrome resize is disabled — too far from the visible card). */
export type WidgetResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const WIDGET_MIN_W = 420;
const WIDGET_MIN_H = 460;

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

/** The review panel parts setPanelOpacity touches (a structural type so tests can pass a fake). */
export type DimmablePanel = Pick<BrowserWindow, 'isDestroyed' | 'setOpacity'> & {
  webContents: Pick<WebContents, 'isDestroyed' | 'insertCSS' | 'removeInsertedCSS'>;
};

/** Settings allow 0.35–1 for a dimmed panel; anything else is clamped before it reaches the page. */
const MIN_PANEL_OPACITY = 0.35;
const panelDim = new WeakMap<object, { queue: Promise<void>; key: string | null }>();

/**
 * Sets how see-through the review panel is.
 *
 * On Windows the panel is a transparent window. Without a usable GPU (software compositing), Chromium
 * draws each new frame of a transparent window with UpdateLayeredWindow. BrowserWindow.setOpacity
 * calls SetLayeredWindowAttributes, and after that Windows refuses every UpdateLayeredWindow call:
 * the panel stays frozen on screen with the old review while the page keeps updating underneath
 * (Electron issue #32555; real-device runs 40266232417 and 40266929130). Even setOpacity(1) does it.
 * So on Windows the window's own opacity is never touched; the page dims itself with a stylesheet.
 * Stylesheet changes run strictly one after another, so the last call wins: a quick blur then
 * focus ends undimmed. Other platforms keep win.setOpacity exactly as before.
 */
export function setPanelOpacity(win: DimmablePanel, opacity: number, platform: NodeJS.Platform = process.platform): Promise<void> {
  if (win.isDestroyed()) return Promise.resolve();
  if (platform !== 'win32') {
    win.setOpacity(opacity);
    return Promise.resolve();
  }
  const value = Number.isFinite(opacity) ? Math.min(1, Math.max(MIN_PANEL_OPACITY, opacity)) : 1;
  const contents = win.webContents;
  const state = panelDim.get(contents) ?? { queue: Promise.resolve(), key: null };
  panelDim.set(contents, state);
  state.queue = state.queue
    .then(async () => {
      if (contents.isDestroyed()) return;
      if (state.key) {
        const key = state.key;
        state.key = null;
        await contents.removeInsertedCSS(key);
      }
      if (value < 1 && !contents.isDestroyed()) state.key = await contents.insertCSS(`html { opacity: ${value} !important; }`);
    })
    .catch((error: unknown) => console.warn('[unvibe] review panel opacity not applied', error));
  return state.queue;
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
  // Use the same level as the Island so the review remains reachable above a
  // full-screen editor, not just ordinary desktop windows.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  if (process.platform === 'darwin') win.setHiddenInMissionControl(true);
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
    if (limitPauseActive) {
      void setPanelOpacity(win, 1);
      return;
    }
    const behavior = settings().all().inactiveBehavior;
    if (behavior === 'dim') void setPanelOpacity(win, settings().all().widgetOpacityInactive);
  });
  win.on('focus', () => {
    if (win.isDestroyed()) return;
    void setPanelOpacity(win, 1);
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

/** Keep the overlay visible over Cursor after the beta explanations are used up. */
export function raiseLimitPause(win: BrowserWindow | null): void {
  limitPauseActive = true;
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  void setPanelOpacity(win, 1);
  if (win.isMinimized()) win.restore();
  win.show();
  win.moveTop();
  win.focus();
}

export function clearLimitPause(): void {
  limitPauseActive = false;
}

export function createCompanion(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 620,
    // 'hiddenInset' is macOS-only; elsewhere it would drop the min/max/close buttons, so draw
    // them as an overlay in the companion's paper colour (v7 --v-bg).
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : { titleBarStyle: 'hidden' as const, titleBarOverlay: { color: '#f5f2ea', symbolColor: '#141414', height: 40 } }),
    backgroundColor: settings().all().theme === 'light' ? '#ffffff' : '#0c1020',
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
