import { BrowserWindow, screen, shell } from 'electron';
import path from 'node:path';
import { settings, type BarPosition } from './settings';

const preload = () => path.join(__dirname, '../preload/preload.cjs');
const page = (name: string) => path.join(__dirname, `../renderer/${name}/${name}.html`);

const SNAP = 18;

const secureWebPrefs = () => ({
  preload: preload(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
});

/** Renderers are local files; deny any attempt to open new windows or navigate away. */
function lockNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function barBounds(position: BarPosition, w: number, h: number): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  const cx = workArea.x + Math.round((workArea.width - w) / 2);
  const right = workArea.x + workArea.width - w - 12;
  const top = workArea.y + 12;
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

export function createBar(): BrowserWindow {
  const width = 248;
  const height = 44;
  const { x, y } = barBounds(settings().all().barPosition, width, height);
  const win = new BrowserWindow({
    width,
    height,
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
    webPreferences: secureWebPrefs(),
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockNavigation(win);
  void win.loadFile(page('bar'));
  return win;
}

/** Move the bar to a new position (called when the setting changes). */
export function positionBar(win: BrowserWindow): void {
  const b = win.getBounds();
  const { x, y } = barBounds(settings().all().barPosition, b.width, b.height);
  win.setBounds({ ...b, x, y });
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

export function createWidget(): BrowserWindow {
  const s = settings().all();
  const cursor = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  const w = 440;
  const h = 560;

  // Restore the last-used size/position; else place near the cursor.
  const saved = s.lastWidgetBounds;
  const bounds = saved
    ? { ...saved }
    : {
        width: w,
        height: h,
        x: Math.min(Math.max(cursor.x + 24, workArea.x), workArea.x + workArea.width - w - 12),
        y: Math.min(Math.max(cursor.y - 40, workArea.y), workArea.y + workArea.height - h - 12),
      };
  // Nudge so a second widget doesn't perfectly overlap the first.
  const stagger = BrowserWindow.getAllWindows().length * 26;
  bounds.x += saved ? stagger : 0;
  bounds.y += saved ? stagger : 0;

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 340,
    minHeight: 200,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: secureWebPrefs(),
  });
  win.setAlwaysOnTop(true, 'floating');

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
    // 'stay' leaves it fully opaque; 'collapse' is handled in the renderer via IPC.
    if (behavior === 'collapse') win.webContents.send('widget:autocollapse', true);
  });
  win.on('focus', () => {
    if (win.isDestroyed()) return;
    win.setOpacity(1);
    if (settings().all().inactiveBehavior === 'collapse') win.webContents.send('widget:autocollapse', false);
  });

  lockNavigation(win);
  void win.loadFile(page('widget'));
  return win;
}

export function createCompanion(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 620,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f4f1ec',
    webPreferences: secureWebPrefs(),
  });
  lockNavigation(win);
  void win.loadFile(page('companion'));
  return win;
}
