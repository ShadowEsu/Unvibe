/**
 * Unvibe desktop agent.
 * Owns: tray, floating bar, widget windows, companion window, global shortcut, selection
 * capture, secret filtering, the local learning store, account/auth, and ALL network I/O.
 * Renderers are sandboxed (CSP: no network) and talk only over the preload bridge.
 */
import { app, BrowserWindow, Menu, Tray, clipboard, globalShortcut, ipcMain, nativeImage } from 'electron';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createBar, createCompanion, createWidget } from './windows';
import { captureSelection, frontmostApp } from './selection';
import {
  initWidget,
  runReview,
  startComprehension,
  gradeComprehension,
  type ReviewSession,
  type RequestOpts,
} from './review';
import { store } from './store';
import { flush } from './sync';
import { signIn, deleteAccount } from './backend';
import { computeProfile, computeFeed } from '../core/learning';

function firstName(): Promise<string> {
  return new Promise((resolve) => {
    execFile('id', ['-F'], { timeout: 1500 }, (err, stdout) => {
      const full = err ? '' : stdout.trim();
      resolve(full.split(/\s+/)[0] || process.env.USER || 'there');
    });
  });
}

const todayKey = () => new Date().toISOString().slice(0, 10);

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
  const session: ReviewSession = {
    reviewId: randomUUID(),
    code,
    sourceApp,
    abort: null,
    recorded: false,
    level: 'intermediate',
  };
  sessions.set(win.webContents.id, session);
  win.on('closed', () => {
    session.abort?.abort();
    sessions.delete(win.webContents.id);
    normalBounds.delete(win.id);
  });
}

function widgetOf(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

app.whenReady().then(() => {
  store(); // initialise persistence early
  void flush(); // backfill any queued events from a previous run

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

  createBar();
  globalShortcut.register('Alt+Space', () => void startReview());

  // --- bar / companion ---
  ipcMain.on('bar:review', () => void startReview());
  ipcMain.on('bar:openCompanion', () => openCompanion());
  ipcMain.on('companion:review', () => void startReview());

  // --- widget lifecycle ---
  ipcMain.on('widget:ready', (e) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (!win || !session) return;
    initWidget(win, session);
    if (session.code) void runReview(win, session, { level: session.level });
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
    session.recorded = false;
    initWidget(win, session);
    if (session.code) void runReview(win, session, opts);
  });
  ipcMain.on('widget:testMe', (e) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (win && session) void startComprehension(win, session);
  });
  ipcMain.on('widget:answer', (e, choice: number) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (win && session) gradeComprehension(win, session, choice);
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

  // --- app info + learning reads ---
  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    user: await firstName(),
    shortcut: '⌥ Space',
  }));
  ipcMain.handle('learning:profile', () => computeProfile(store().events(), todayKey()));
  ipcMain.handle('learning:feed', (_e, limit: number) => computeFeed(store().events(), limit ?? 8));

  // --- account ---
  ipcMain.handle('account:get', () => store().account());
  ipcMain.handle('account:signIn', async (_e, email: string) => {
    try {
      const acct = await signIn(email);
      store().setAccount(acct.userId, acct.email, acct.token);
      void flush();
      return { ok: true, email: acct.email };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed.' };
    }
  });
  ipcMain.handle('account:signOut', () => {
    store().signOut();
    return { ok: true };
  });
  ipcMain.handle('account:delete', async () => {
    const token = store().token();
    try {
      if (token) await deleteAccount(token);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Delete failed.' };
    }
    store().wipeEverything(); // remove local data too
    return { ok: true };
  });
});

app.on('browser-window-focus', () => void flush());
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  /* keep the agent alive — this is a menu-bar utility */
});
