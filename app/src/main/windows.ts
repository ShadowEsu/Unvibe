import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const preload = () => path.join(__dirname, '../preload/preload.cjs');
const page = (name: string) => path.join(__dirname, `../renderer/${name}/${name}.html`);

export function createBar(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 248;
  const win = new BrowserWindow({
    width,
    height: 44,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + workArea.height - 56,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: { preload: preload(), contextIsolation: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void win.loadFile(page('bar'));
  return win;
}

export function createWidget(): BrowserWindow {
  const cursor = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  const w = 440;
  const h = 560;
  const win = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 340,
    minHeight: 200,
    x: Math.min(Math.max(cursor.x + 24, workArea.x), workArea.x + workArea.width - w - 12),
    y: Math.min(Math.max(cursor.y - 40, workArea.y), workArea.y + workArea.height - h - 12),
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: { preload: preload(), contextIsolation: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.on('blur', () => !win.isDestroyed() && win.setOpacity(0.72));
  win.on('focus', () => !win.isDestroyed() && win.setOpacity(1));
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
    backgroundColor: '#f6f4f1',
    webPreferences: { preload: preload(), contextIsolation: true, nodeIntegration: false },
  });
  void win.loadFile(page('companion'));
  return win;
}
