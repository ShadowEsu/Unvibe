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
import path from 'node:path';
import { createBar, createCompanion, createWidget, positionBar } from './windows';
import { captureSelection, frontmostApp, startFrontmostWatch } from './selection';
import type { ExplanationLevel } from '../core/protocol';
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
import { flush, onSyncStatus, retrySync, stopSync, syncStatus } from './sync';
import {
  signIn,
  signUp,
  signOut as revokeSession,
  deleteAccount,
  startDeviceAuth,
  redeemDeviceAuth,
  accountInfo,
  type Account as BackendAccount,
} from './backend';
import { setBar, notify } from './notify';
import { computeProfile, computeFeed, localDayKey } from '../core/learning';

function firstName(): Promise<string> {
  return new Promise((resolve) => {
    execFile('id', ['-F'], { timeout: 1500 }, (err, stdout) => {
      const full = err ? '' : stdout.trim();
      resolve(full.split(/\s+/)[0] || process.env.USER || 'there');
    });
  });
}

const todayKey = () => localDayKey(new Date());
const isMac = process.platform === 'darwin';

let tray: Tray | null = null;
let bar: BrowserWindow | null = null;
let companion: BrowserWindow | null = null;
let devicePoll: NodeJS.Timeout | null = null;
const sessions = new Map<number, ReviewSession>();
const normalBounds = new Map<number, Electron.Rectangle>();

onSyncStatus((status) => {
  if (companion && !companion.isDestroyed()) companion.webContents.send('sync:status', status);
});

async function persistAccount(account: BackendAccount): Promise<void> {
  try {
    store().setAccount(account.userId, account.email, account.token);
  } catch (error) {
    try {
      await revokeSession(account.token);
    } catch {
      // The original secure-storage error is more actionable; the server will still expire
      // an unreachable orphan session according to its session policy.
    }
    throw error;
  }
}

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

function asset(...parts: string[]): string {
  return path.join(__dirname, '..', 'assets', ...parts);
}

async function startReview(): Promise<void> {
  broadcastShortcut();
  if (isMac && !accessibilityGranted(false)) {
    accessibilityGranted(true);
    if (!accessibilityGranted(false)) {
      void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
      openCompanion();
      notify('Turn on Accessibility for Unvibe so selection works');
    }
  }
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

app.setName('Unvibe');

app.whenReady().then(() => {
  store();
  const s = settings().all();
  if (isMac) app.setLoginItemSettings({ openAtLogin: s.launchAtLogin });
  void flush();
  startFrontmostWatch();

  const dockIcon = nativeImage.createFromPath(asset('icon.png'));
  if (isMac && !dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);

  let trayImage = nativeImage.createFromPath(asset('trayTemplate.png'));
  if (trayImage.isEmpty()) trayImage = dockIcon.resize({ width: 18, height: 18 });
  else if (isMac) trayImage.setTemplateImage(true);
  tray = new Tray(trayImage);
  tray.setIgnoreDoubleClickEvents(true);
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
  if (bar && !bar.isDestroyed()) {
    bar.showInactive();
    positionBar(bar);
  }
  registerShortcut(s.shortcut);
  // Always open the companion home window and keep the bottom bar visible on launch.
  openCompanion();

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
  });
  ipcMain.on('widget:request', (e, opts: RequestOpts) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (win && session) void runReview(win, session, opts);
  });
  ipcMain.on('widget:useClipboard', (e, opts: { level?: ExplanationLevel }) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (!win || !session) return;
    const text = clipboard.readText();
    session.code = text.length > 0 ? text : null;
    session.recorded = false;
    if (opts?.level) session.level = opts.level;
    initWidget(win, session);
  });
  ipcMain.on('widget:cancel', (e) => {
    const win = widgetOf(e);
    const session = sessions.get(e.sender.id);
    if (!win || !session) return;
    session.abort?.abort();
    win.webContents.send('review:event', { type: 'cancelled' });
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
  ipcMain.handle('sync:status', () => syncStatus());
  ipcMain.handle('sync:retry', async () => {
    await retrySync();
    return syncStatus();
  });

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

  // --- external links ---
  ipcMain.handle('app:openPrivacy', () => {
    void shell.openExternal('https://unvibe.app/privacy');
    return { ok: true };
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
      await persistAccount(acct);
      void flush();
      return { ok: true, email: acct.email };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed.' };
    }
  });
  ipcMain.handle('account:signUp', async (_e, email: string) => {
    try {
      const acct = await signUp(email);
      await persistAccount(acct);
      void flush();
      return { ok: true, email: acct.email };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Sign-up failed.' };
    }
  });
  ipcMain.handle('account:startDevice', async () => {
    try {
      const device = await startDeviceAuth();
      void shell.openExternal(`${device.verificationUri}?code=${encodeURIComponent(device.userCode)}`);
      if (devicePoll) clearInterval(devicePoll);
      const expires = Date.now() + 10 * 60_000;
      devicePoll = setInterval(() => void (async () => {
        if (Date.now() > expires) { if (devicePoll) clearInterval(devicePoll); devicePoll = null; companion?.webContents.send('account:device', { ok: false, error: 'Sign-in timed out. Start again.' }); return; }
        try {
          const redeemed = await redeemDeviceAuth(device.deviceCode);
          if (!redeemed) return;
          const account = await accountInfo(redeemed.token);
          await persistAccount({
            userId: account.userId,
            email: account.email ?? 'Signed-in user',
            token: redeemed.token,
          });
          if (devicePoll) clearInterval(devicePoll); devicePoll = null;
          void flush();
          companion?.webContents.send('account:device', { ok: true, email: account.email ?? 'Signed-in user' });
        } catch { /* polling retries until expiry */ }
      })(), Math.max(2, device.interval) * 1000);
      return { ok: true, userCode: device.userCode, verificationUri: device.verificationUri };
    } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Could not start secure sign-in.' }; }
  });
  ipcMain.handle('account:signOut', async () => {
    const token = store().token();
    let warning: string | undefined;
    if (token) {
      try {
        await revokeSession(token);
      } catch (err) {
        warning = err instanceof Error ? err.message : 'The remote session could not be revoked.';
      }
    }
    try {
      store().signOut();
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Local sign-out could not be saved.', warning };
    }
    return { ok: true, warning };
  });
  ipcMain.handle('account:delete', async () => {
    const token = store().token();
    try {
      if (token) await deleteAccount(token);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Delete failed.' };
    }
    try {
      store().wipeEverything();
    } catch (err) {
      return {
        ok: false,
        error: `The remote account was deleted, but local cleanup failed. ${err instanceof Error ? err.message : ''}`.trim(),
      };
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (sessions.has(win.webContents.id) && !win.isDestroyed()) win.close();
    }
    sessions.clear();
    return { ok: true };
  });
});

app.on('browser-window-focus', () => void flush());
app.on('will-quit', () => {
  stopSync();
  globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => {
  /* keep the agent alive — this is a menu-bar utility */
});
