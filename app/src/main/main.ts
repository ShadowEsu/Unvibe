/**
 * Unvibe desktop agent.
 * Owns: tray, floating bar, widget windows, companion window, the global shortcut, selection
 * capture, secret filtering, the local learning store, settings, account/auth, and ALL network
 * I/O. Renderers are sandboxed (CSP: no network) and talk only over the preload bridge.
 */
import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  clipboard,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell,
  systemPreferences,
} from 'electron';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createBar, createCompanion, createWidget, positionBar } from './windows';
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
import { settings, type Settings } from './settings';
import { flush } from './sync';
import { signIn, deleteAccount } from './backend';
import { setBar, notify } from './notify';
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
const isMac = process.platform === 'darwin';

let tray: Tray | null = null;
let bar: BrowserWindow | null = null;
let companion: BrowserWindow | null = null;
const sessions = new Map<number, ReviewSession>();
const normalBounds = new Map<number, Electron.Rectangle>();

function accessibilityGranted(prompt = false): boolean {
  if (!isMac) return true;
  return systemPreferences.isTrustedAccessibilityClient(prompt);
}

function openCompanion(): void {
  if (companion && !companion.isDestroyed()) {
    companion.show();
    companion.focus();
    return;
  }
  companion = createCompanion();
  companion.on('closed', () => (companion = null));
}

function broadcastShortcut(): void {
  if (companion && !companion.isDestroyed()) companion.webContents.send('shortcut:fired');
}

async function startReview(): Promise<void> {
  broadcastShortcut();
  const [code, sourceApp] = await Promise.all([captureSelection(), frontmostApp()]);
  const win = createWidget();
  const session: ReviewSession = {
    reviewId: randomUUID(),
    code,
    sourceApp,
    abort: null,
    recorded: false,
    level: 'intermediate',
    onRecorded: () => notify('Added to your learning history'),
    onUnderstood: () => notify('Nice — concept understood'),
  };
  sessions.set(win.webContents.id, session);
  win.on('closed', () => {
    session.abort?.abort();
    sessions.delete(win.webContents.id);
    normalBounds.delete(win.id);
  });
}

function registerShortcut(accel: string): boolean {
  globalShortcut.unregisterAll();
  try {
    return globalShortcut.register(accel, () => void startReview());
  } catch {
    return false;
  }
}

function widgetOf(e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender);
}

app.whenReady().then(() => {
  store();
  const s = settings().all();
  if (isMac) app.setLoginItemSettings({ openAtLogin: s.launchAtLogin });
  void flush();

  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('◆');
  tray.setToolTip('Unvibe');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Review selection', click: () => void startReview() },
      { label: 'Open Unvibe', click: openCompanion },
      { type: 'separator' },
      { label: 'Quit Unvibe', role: 'quit' },
    ]),
  );

  bar = createBar();
  setBar(bar);
  registerShortcut(s.shortcut);

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
  ipcMain.on('widget:openStudy', () => openCompanion());

  // --- app info + learning reads ---
  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    user: await firstName(),
    shortcut: settings().all().shortcut,
  }));
  ipcMain.handle('learning:profile', () => computeProfile(store().events(), todayKey()));
  ipcMain.handle('learning:feed', (_e, limit: number) => computeFeed(store().events(), limit ?? 8));

  // --- settings ---
  ipcMain.handle('settings:get', () => settings().all());
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const before = settings().all().shortcut;
    const next = settings().set(patch);
    if (patch.shortcut && patch.shortcut !== before) {
      const ok = registerShortcut(next.shortcut);
      if (!ok) {
        settings().set({ shortcut: before });
        registerShortcut(before);
        return { settings: settings().all(), shortcutError: 'That shortcut is taken or invalid.' };
      }
    }
    if (patch.barPosition && bar && !bar.isDestroyed()) positionBar(bar);
    return { settings: settings().all() };
  });

  // --- permissions ---
  ipcMain.handle('perms:accessibility', () => ({ granted: accessibilityGranted(false), platform: process.platform }));
  ipcMain.handle('perms:promptAccessibility', () => ({ granted: accessibilityGranted(true) }));
  ipcMain.handle('perms:openAccessibility', () => {
    if (isMac)
      void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    return { ok: true };
  });

  // --- onboarding ---
  ipcMain.handle('onboarding:complete', () => settings().set({ onboarded: true }));

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
    store().wipeEverything();
    return { ok: true };
  });
});

app.on('browser-window-focus', () => void flush());
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  /* keep the agent alive — this is a menu-bar utility */
});
