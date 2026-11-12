import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron';
import path from 'node:path';
import { settings, type BarPosition, type BarSize, type InactiveBehavior, type ThemePreference } from './settings';
import { ownCodeStepDueNow } from './ownCodeStep';
import { isSafeExternalUrl } from '../core/permissions';

const preload = () => path.join(__dirname, '../preload/preload.cjs');
const page = (name: string) => path.join(__dirname, `../renderer/${name}/${name}.html`);

const SNAP = 18;
/**
 * Overlay B (Design b-refined SPEC, Pane): 380 wide; the height fits the content between 360 and 560, past which
 * the answer scrolls inside while the header and tabs stay. The renderer measures its content (widget:fitHeight).
 */
export const PANEL_W = 380;
export const PANEL_MIN_H = 360;
export const PANEL_MAX_H = 560;
/** One shared review panel — ⌘U reuses this instead of stacking windows. */
let panelWin: BrowserWindow | null = null;
let barIsExpanded = false;
/** A notice's text is showing under the compact Island (renderer bar:setNotice). */
let barHasNotice = false;
let limitPauseActive = false;
/** A file or folder dialog the panel opened is up: its blur is not a click away. */
let panelDialogs = 0;

/** Runs a dialog the panel opened; meanwhile losing focus neither fades nor hides the panel. */
export async function whilePanelDialog<T>(work: () => Promise<T>): Promise<T> {
  panelDialogs += 1;
  try {
    return await work();
  } finally {
    panelDialogs -= 1;
  }
}

/** The panel's guide opened System Settings for Accessibility: losing focus to it is not a click away. Cleared when
 * the grant arrives (or the panel closes). */
let grantFlowOpen = false;
export function setGrantFlowOpen(open: boolean): void {
  grantFlowOpen = open;
}

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
/**
 * Height of the expanded overview under (or above) the compact row: header, tiles, ramp, allowance, hint, an
 * optional note and the actions with no dead band above the buttons (Design Spectral island S-1, 07 Nov: ~220).
 * 230 leaves room for the note when the card opens upward from a bottom bar (11 px top padding there).
 */
const BAR_EXPANDED_BODY_H = 230;
const FLOATING_ROW_H = 38;
/**
 * A notice (notify()) shows its text under the compact row (above it at the bottom) without
 * expanding the Island: up to three lines, never wider than the expanded card (F-18).
 */
const BAR_NOTICE_H = 64;

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
  const attached = attachedIsland(position);
  if (expanded) {
    if (attached) return { width: compactBarWidth(position), height: BAR_EXPANDED_BODY_H + islandSafeTop(position) };
    return { width: FLOATING_EXPANDED_W, height: BAR_EXPANDED_BODY_H + FLOATING_ROW_H };
  }
  if (barHasNotice) return { width: attached ? compactBarWidth(position) : FLOATING_EXPANDED_W, height: compactBarHeight(position) + BAR_NOTICE_H };
  return { width: compactBarWidth(position), height: compactBarHeight(position) };
}

export function createBar(): BrowserWindow {
  barIsExpanded = false;
  barHasNotice = false;
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
  applyBarSize(win, force);
}

/**
 * The Island grows to show a notice's text, and back when the notice is gone. A hidden Island only
 * records it (showBar sizes it then): resizing calls moveTop, which on macOS brings a hidden window back.
 */
export function setBarNotice(win: BrowserWindow | null, on: boolean): void {
  if (!win || win.isDestroyed() || barHasNotice === on) return;
  barHasNotice = on;
  if (!barIsExpanded && win.isVisible()) applyBarSize(win, false);
}

function applyBarSize(win: BrowserWindow, force: boolean): void {
  const position = settings().all().barPosition;
  const { width, height } = barSize(position, barIsExpanded);
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

/**
 * The panel inside a work area: 12 px from every edge (24 in all, Design Q3) and, when the Island sits at the
 * top, clear of it: a panel that would reach under the Island starts 8 px below it and gets shorter instead.
 * (At 1024 px wide a 440 px panel can't step aside, and QA saw its corner under the Island there.) Only a real
 * overlap counts (the Island may be on another display), and only if the room below still fits the minimum height.
 */
export function fitPanelBounds(bounds: Electron.Rectangle, workArea: Electron.Rectangle, island?: Electron.Rectangle): Electron.Rectangle {
  const width = Math.min(bounds.width, workArea.width - 24);
  let height = Math.min(bounds.height, workArea.height - 24);
  const x = Math.min(Math.max(bounds.x, workArea.x + 12), workArea.x + workArea.width - width - 12);
  let y = Math.min(Math.max(bounds.y, workArea.y + 12), workArea.y + workArea.height - height - 12);
  if (island && x < island.x + island.width && x + width > island.x && y < island.y + island.height && y + height > island.y) {
    const below = island.y + island.height + 8;
    const room = workArea.y + workArea.height - 12 - below;
    if (room >= Math.min(height, PANEL_MIN_H)) {
      y = below;
      height = Math.min(height, room);
    }
  }
  return { x, y, width, height };
}

/** Where the compact Island is when it sits at the top of the display it's on; undefined for a bottom bar. */
function topIslandRect(): Electron.Rectangle | undefined {
  const position = settings().all().barPosition;
  if (!position.startsWith('top')) return undefined;
  const { width, height } = barSize(position, false);
  return { ...barBounds(position, width, height), width, height };
}

function clampToVisibleArea(bounds: Electron.Rectangle): Electron.Rectangle {
  const displays = screen.getAllDisplays();
  const visible = displays.find(({ workArea }) =>
    bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x &&
    bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y,
  );
  return fitPanelBounds(bounds, (visible ?? screen.getPrimaryDisplay()).workArea, topIslandRect());
}

function defaultWidgetBounds(): Electron.Rectangle {
  const cursor = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  const w = PANEL_W;
  const h = PANEL_MIN_H;
  return {
    width: w,
    height: h,
    x: Math.min(Math.max(cursor.x + 24, workArea.x), workArea.x + workArea.width - w - 12),
    y: Math.min(Math.max(cursor.y - 40, workArea.y), workArea.y + workArea.height - h - 12),
  };
}

/** Where the panel was last left; its size is always overlay B's (the content decides the height). */
function resolveWidgetBounds(): Electron.Rectangle {
  const saved = settings().all().lastWidgetBounds;
  if (!saved) return defaultWidgetBounds();
  return { x: saved.x, y: saved.y, width: PANEL_W, height: PANEL_MIN_H };
}

/** The window height for content this tall: between 360 and 560 (past that the answer scrolls inside). */
export function panelHeightFor(contentHeight: number): number {
  if (!Number.isFinite(contentHeight)) return PANEL_MIN_H;
  return Math.round(Math.min(PANEL_MAX_H, Math.max(PANEL_MIN_H, contentHeight)));
}

/** Fits the panel to its content's height, kept inside the work area and clear of a top Island. */
export function fitPanelHeight(win: BrowserWindow, contentHeight: number): void {
  if (win.isDestroyed()) return;
  const current = win.getBounds();
  const height = panelHeightFor(contentHeight);
  if (current.height === height && current.width === PANEL_W) return;
  win.setBounds(clampToVisibleArea({ ...current, width: PANEL_W, height }), false);
}

/**
 * What the panel does when it loses focus: Fade (the default) drops the pane to 22 % but keeps it clickable;
 * Hide closes the window and keeps its state for ⌃U. While the explanation limit holds the panel up, it stays.
 */
export function clickAwayOnBlur(behavior: InactiveBehavior, limitPause: boolean): InactiveBehavior | 'stay' {
  if (limitPause) return 'stay';
  return behavior === 'hide' ? 'hide' : 'fade';
}

/** Tells the panel page whether it is faded (it animates the opacity itself, so reduced motion is honoured). */
function sendAway(win: BrowserWindow, away: boolean): void {
  if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('panel:away', away);
}

function buildWidgetWindow(bounds: Electron.Rectangle): BrowserWindow {
  const win = new BrowserWindow({
    ...clampToVisibleArea(bounds),
    minWidth: PANEL_W,
    minHeight: PANEL_MIN_H,
    maxWidth: PANEL_W,
    maxHeight: PANEL_MAX_H,
    frame: false,
    transparent: true,
    // The content decides the height (widget:fitHeight); the width is fixed.
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

  // Moving saves where the panel is; its size always comes from overlay B and the content.
  win.on('moved', () => {
    snap(win);
    if (win.isDestroyed()) return;
    settings().set({ lastWidgetBounds: win.getBounds() });
  });

  win.on('blur', () => {
    if (win.isDestroyed()) return;
    const action = clickAwayOnBlur(settings().all().inactiveBehavior, limitPauseActive || panelDialogs > 0 || grantFlowOpen);
    if (action === 'hide') win.hide();
    else if (action === 'fade') sendAway(win, true);
  });
  win.on('focus', () => sendAway(win, false));

  lockNavigation(win);
  win.once('ready-to-show', () => win.showInactive());
  // The theme rides in the URL so the panel's first paint matches Settings › Theme.
  void win.loadFile(page('widget'), { query: { theme: settings().all().theme ?? 'light' } });
  return win;
}

/** Prefer the existing review panel; create only when needed. */
export function getOrCreateWidget(): BrowserWindow {
  if (panelWin && !panelWin.isDestroyed()) {
    if (panelWin.isMinimized()) panelWin.restore();
    // A faded panel comes back before it is focused: the shortcut always shows a full panel.
    sendAway(panelWin, false);
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

/**
 * The panel shows without taking focus, so the editor keeps its selection. A Mac without
 * Accessibility gets the panel's paste box instead, and ⌘V must land there, not in the editor: make
 * Unvibe the active app and the panel its key window. A fresh panel shows on ready-to-show, so wait
 * for that (its own showInactive runs first).
 */
export function focusPanelForPaste(win: BrowserWindow, fresh: boolean): void {
  const take = () => {
    if (win.isDestroyed()) return;
    app.focus({ steal: true });
    win.focus();
  };
  if (fresh) win.once('ready-to-show', take);
  else take();
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
  sendAway(win, false);
  if (win.isMinimized()) win.restore();
  win.show();
  win.moveTop();
  win.focus();
}

export function clearLimitPause(): void {
  limitPauseActive = false;
}

/** The part of a BrowserWindow the reveal uses (a fake in tests). */
export type RevealTarget = Pick<BrowserWindow, 'isDestroyed' | 'maximize' | 'show' | 'setAlwaysOnTop' | 'moveTop' | 'focus'>;

/** `reveal` shows the companion once (later calls do nothing); `revealed` says whether it has. */
export interface CompanionRevealer {
  reveal: () => void;
  revealed: () => boolean;
}

/**
 * The companion's one reveal, once its page has drawn its first real screen (companionPainted): maximized first
 * on a first run, then shown, and with `front` (a first-run launch the user started) brought above other apps.
 * Later calls do nothing, so that signal and the 5 s fallback can both call it.
 */
export function companionRevealer(win: RevealTarget, { maximize, front, platform }: { maximize: boolean; front: boolean; platform: NodeJS.Platform }): CompanionRevealer {
  let shown = false;
  const reveal = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    if (maximize) win.maximize();
    win.show();
    if (!front) return;
    // Windows won't hand focus to a window whose process didn't get the foreground (it flashes the
    // taskbar button instead); topmost and straight back puts it above the other windows anyway.
    if (platform === 'win32') {
      win.setAlwaysOnTop(true);
      win.setAlwaysOnTop(false);
    }
    win.moveTop();
    win.focus();
  };
  return { reveal, revealed: () => shown };
}

/** Companions whose reveal hasn't run yet: their page hasn't drawn its first real screen. */
const companionReveals = new WeakMap<BrowserWindow, CompanionRevealer>();

/**
 * Whether this companion is still loading, hidden until its first real screen (companionPainted). Reopening it
 * then must not show it early (blank) or out of turn: its reveal shows it.
 */
export function companionLoading(win: BrowserWindow): boolean {
  return companionReveals.get(win)?.revealed() === false;
}

/** The window events armCompanionReveal listens to (a BrowserWindow, or a stand-in in tests). */
export interface RevealWiring { once(event: 'show' | 'closed', listener: () => void): unknown }

/**
 * The hidden companion's fallback: it shows after `fallbackMs` unless it showed or closed first. Nothing else here
 * reveals it; in particular not ready-to-show, which fires on the empty 'checking' frame (#208). The page's own
 * signal (companionPainted) is the normal reveal.
 */
export function armCompanionReveal(win: RevealWiring, reveal: () => void, fallbackMs = 5000): void {
  const fallback = setTimeout(reveal, fallbackMs);
  win.once('show', () => clearTimeout(fallback));
  win.once('closed', () => clearTimeout(fallback));
}

/**
 * The companion's page has drawn its first real screen (setup, sign-in or the app; not the empty frame it shows
 * while it reads its settings): show it now. Chromium's ready-to-show fires on that empty frame, which is the blank
 * first window QA measured on Windows (#208), so the reveal waits for the page instead.
 */
export function companionPainted(win: BrowserWindow): void {
  companionReveals.get(win)?.reveal();
}

/**
 * The companion's own chrome (round 2 glass): the window background behind the first paint (the veil's flat colour),
 * and on Windows and Linux the min/max/close overlay. The overlay takes the ground's colour at the window's top-right
 * corner at 1180 × 780 (sampled from the renders), not a translucent one: Electron 36 ignores the overlay colour's
 * alpha on Linux (it painted black) and Windows is unverified, so a flat match is the safe choice (BOSS
 * 20261110-1331's white box). "system" follows the OS appearance.
 */
export function companionChrome(theme: ThemePreference, osDark = nativeTheme.shouldUseDarkColors, stage = false): {
  background: string;
  overlay: { color: string; symbolColor: string; height: number };
} {
  // While the start stage (the sharks, dark in both themes) is up, the window-button strip and the first paint take
  // the stage's ground so a light theme never shows a lilac strip over the dark ocean (Design S-1 whole-app MUST 14).
  if (stage) return { background: '#16122a', overlay: { color: '#17122f', symbolColor: '#f3f1fa', height: 40 } };
  const dark = theme === 'dark' || (theme === 'system' && osDark);
  return dark
    ? { background: '#16122a', overlay: { color: '#1f1643', symbolColor: '#f3f1fa', height: 40 } }
    : { background: '#f3f0fb', overlay: { color: '#cac0ec', symbolColor: '#15141a', height: 40 } };
}

/**
 * The stage shows on a launch into the app proper with the Settings row on: not the first run, and not an open
 * that leads with the own-code step (the renderer ends the stage for both).
 */
function stageAtLaunch(): boolean {
  const all = settings().all();
  return all.onboarded && all.startAnimation && !ownCodeStepDueNow();
}

/** Re-colour an open companion after a theme change (Settings › Theme, or the OS when the theme is "system"). */
export function applyCompanionChrome(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  const chrome = companionChrome(settings().all().theme);
  win.setBackgroundColor(chrome.background);
  if (process.platform !== 'darwin') win.setTitleBarOverlay(chrome.overlay);
}

/**
 * The home window. It stays hidden until its page has drawn its first real screen (companionPainted), so nobody
 * sees a blank (on first run, maximized) window while it loads; if the page never says so, it shows anyway after
 * 5 s. `front` (a first-run launch the user started) then brings it above other apps.
 */
export function createCompanion({ front = false }: { front?: boolean } = {}): BrowserWindow {
  const stage = stageAtLaunch();
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 620,
    // 'hiddenInset' is macOS-only; elsewhere it would drop the min/max/close buttons, so draw
    // them as an overlay in the theme's ground colour (the companion reserves 150 px for it).
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : { titleBarStyle: 'hidden' as const, titleBarOverlay: companionChrome(settings().all().theme, undefined, stage).overlay }),
    backgroundColor: companionChrome(settings().all().theme, undefined, stage).background,
    skipTaskbar: false,
    show: false,
    webPreferences: secureWebPrefs(),
  });
  lockNavigation(win);
  // Setup is intentionally a full-window moment. Once it is complete, future
  // launches retain the normal companion size so the app stays out of the way.
  const revealer = companionRevealer(win, { maximize: !settings().all().onboarded, front, platform: process.platform });
  companionReveals.set(win, revealer);
  armCompanionReveal(win, revealer.reveal);
  // The page draws its loading frame on the ground of the screen to come (the stage's, or the app's). A window
  // hidden at creation gets no frames, so that frame is the one on screen for the moment after the reveal (#208).
  void win.loadFile(page('companion'), { query: { first: stage ? 'stage' : 'app' } });
  return win;
}
