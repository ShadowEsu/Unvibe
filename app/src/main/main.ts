/**
 * Unvibe desktop agent (Milestone D1).
 * Owns: tray, floating bar, widget windows, companion window, global shortcut,
 * selection capture, secret filtering, and ALL network I/O. Renderers are
 * sandboxed (CSP: no network) and talk only over the preload bridge.
 */
import { app, BrowserWindow, Menu, Tray, clipboard, globalShortcut, ipcMain, nativeImage } from 'electron';
import { execFile } from 'node:child_process';
import { createBar, createCompanion, createWidget } from './windows';
import { captureSelection, frontmostApp } from './selection';
import { initWidget, runReview, type ReviewSession, type RequestOpts } from './review';

/** macOS full name ("Preston Jay Susanto") → "Preston"; falls back to the unix user. */
function firstName(): Promise<string> {
  return new Promise((resolve) => {
    execFile('id', ['-F'], { timeout: 1500 }, (err, stdout) => {
      const full = err ? '' : stdout.trim();
      resolve(full.split(/\s+/)[0] || process.env.USER || 'there');
    });
  });
}

let tray: Tray | null = null;
let companion: BrowserWindow | null = null;
const sessions = new Map<number, ReviewSession>();
const normalBounds = new Map<number, Electron.Rectangle>();

function openCompanion(): void {
  if (companion && !companion.isDestroyed()) {
    companion.show();
    companion.focus();
    return;
  }
  companion = createCompanion();
  companion.on('closed', () => (companion = null));
}

async function startReview(): Promise<void> {
  const [code, sourceApp] = await Promise.all([captureSelection(), frontmostApp()]);
  const win = createWidget();
  const session: ReviewSession = { code, sourceApp, abort: null };
  sessions.set(win.webContents.id, session);
  win.on('closed', () => {
    session.abort?.abort();
    sessions.delete(win.webContents.id);
    normalBounds.delete(win.id);
  });
  // Widget announces readiness, then receives init + (if code) an auto-started stream.
}

function widgetOf(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

app.whenReady().then(() => {
  // Menu-bar presence (text glyph — no image asset needed on macOS).
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('◆');
  tray.setToolTip('Unvibe');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Review selection', accelerator: 'Alt+Space', click: () => void startReview() },
      { label: 'Open Unvibe', click: openCompanion },
      { type: 'separator' },
      { label: 'Quit Unvibe', role: 'quit' },
    ]),
  );

  createBar(); // retained by Electron until closed
  globalShortcut.register('Alt+Space', () => void startReview());

  // --- IPC ---
  ipcMain.on('bar:review', () => void startReview());
  ipcMain.on('bar:openCompanion', () => openCompanion());
  ipcMain.on('companion:review', () => void startReview());

  ipcMain.on('widget:ready', (e) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (!win || !session) return;
    initWidget(win, session);
    if (session.code) void runReview(win, session, { level: 'intermediate' });
  });

  ipcMain.on('widget:request', (e, opts: RequestOpts) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (win && session) void runReview(win, session, opts);
  });

  ipcMain.on('widget:useClipboard', (e, opts: RequestOpts) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (!win || !session) return;
    const text = clipboard.readText();
    session.code = text.length > 0 ? text : null;
    initWidget(win, session);
    if (session.code) void runReview(win, session, opts);
  });

  ipcMain.on('widget:pin', (e, pinned: boolean) => {
    const win = widgetOf(e);
    if (!win) return;
    win.setAlwaysOnTop(true, pinned ? 'screen-saver' : 'floating');
    win.setVisibleOnAllWorkspaces(pinned, { visibleOnFullScreen: pinned });
  });

  ipcMain.on('widget:collapse', (e, collapsed: boolean) => {
    const win = widgetOf(e);
    if (!win) return;
    if (collapsed) {
      normalBounds.set(win.id, win.getBounds());
      win.setResizable(false);
      win.setBounds({ ...win.getBounds(), height: 52 });
    } else {
      const prev = normalBounds.get(win.id);
      win.setResizable(true);
      if (prev) win.setBounds(prev);
    }
  });

  ipcMain.on('widget:close', (e) => widgetOf(e)?.close());
  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    user: await firstName(),
    shortcut: '⌥ Space',
  }));
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  /* keep the agent alive — this is a menu-bar utility */
});
