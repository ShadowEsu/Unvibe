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
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell,
  systemPreferences,
} from 'electron';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createBar,
  createCompanion,
  currentWidget,
  getOrCreateWidget,
  hideBar,
  positionBar,
  showBar,
} from './windows';
import { captureSelection, frontmostApp, startFrontmostWatch } from './selection';
import type { ExplanationLevel } from '../core/protocol';
import {
  initWidget,
  runReview,
  startComprehension,
  gradeComprehension,
  markUnderstood,
  applyBuiltReview,
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
  billingOverview,
  startBillingCheckout,
  startBillingPortal,
  type Account as BackendAccount,
} from './backend';
import { setBar, notify } from './notify';
import { computeProfile, computeFeed, computeLearningItems, computeReviewQueue, localDayKey } from '../core/learning';
import { resolveAppUsage } from './usage';
import { aiKeyStatus, clearAiKey, writeAiKey } from './aiKey';
import { costOverview } from './localAi';
import {
  buildComparePayload,
  buildDiffPayload,
  buildSelectionPayload,
  isProPlan,
  resolveRepoRoot,
} from './contextBuilder';

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
/** Per-tab review sessions inside the single shared panel. */
const tabSessions = new Map<string, ReviewSession>();
let activeTabId = '1';
let panelReady = false;
const normalBounds = new Map<number, Electron.Rectangle>();

function makeSession(
  tabId: string,
  code: string | null,
  sourceApp: string | null,
  level: ExplanationLevel = 'intermediate',
): ReviewSession {
  return {
    reviewId: randomUUID(),
    tabId,
    code,
    sourceApp,
    abort: null,
    recorded: false,
    level,
    onRecorded: () => notify('Added to your learning history'),
    onUnderstood: () => notify('Nice — concept understood'),
  };
}

function sessionFor(tabId = activeTabId): ReviewSession | undefined {
  return tabSessions.get(tabId);
}

function clearPanelSessions(): void {
  for (const session of tabSessions.values()) session.abort?.abort();
  tabSessions.clear();
  activeTabId = '1';
  panelReady = false;
}

function beginCaptureOnActiveTab(
  win: BrowserWindow,
  code: string | null,
  sourceApp: string | null,
): void {
  const prev = sessionFor(activeTabId);
  prev?.abort?.abort();
  const session = makeSession(activeTabId, code, sourceApp, prev?.level ?? 'intermediate');
  tabSessions.set(activeTabId, session);
  if (!panelReady) return;
  // No selection → calm picker UI (never auto-error / auto-run).
  initWidget(win, session, { autoStart: Boolean(code) });
  if (code) void runReview(win, session, { level: session.level });
}

const MAX_PICK_BYTES = 200_000;

function loadCodeIntoSession(
  win: BrowserWindow,
  session: ReviewSession,
  code: string,
  sourceLabel: string | null,
  level?: ExplanationLevel,
  meta?: { file?: string; project?: string; sourceFilePath?: string },
): void {
  session.abort?.abort();
  session.code = code;
  session.sourceApp = sourceLabel;
  session.recorded = false;
  session.reviewId = randomUUID();
  session.payload = undefined;
  session.mode = 'selection';
  session.file = meta?.file;
  session.project = meta?.project;
  session.sourceFilePath = meta?.sourceFilePath;
  session.snapshotText = meta?.sourceFilePath ? code.slice(0, 12_000) : undefined;
  if (level) session.level = level;
  initWidget(win, session, { autoStart: true });
  void runReview(win, session, { level: session.level });
}

async function requireProOrError(win: BrowserWindow, session: ReviewSession, feature: string): Promise<boolean> {
  const usage = await resolveAppUsage();
  if (isProPlan(usage.plan)) return true;
  win.webContents.send('review:event', {
    type: 'error',
    tabId: session.tabId,
    code: 'pro_required',
    upgradePath: '/plan',
    message: `${feature} is included with Unvibe Pro. Pro connects explanations across diffs, nearby files, and what you already understood.`,
  });
  return false;
}

async function startBuiltReview(
  win: BrowserWindow,
  session: ReviewSession,
  builder: () => Promise<Parameters<typeof applyBuiltReview>[1]>,
  sourceLabel: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const built = await builder();
    session.abort?.abort();
    session.sourceApp = sourceLabel;
    session.reviewId = randomUUID();
    applyBuiltReview(session, built);
    initWidget(win, session, { autoStart: true });
    void runReview(win, session, { level: session.level });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not start that review.' };
  }
}

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
  // Aisle + review panel only appear when you invoke a review (⌘U / start).
  showBar(bar);
  const [code, sourceApp] = await Promise.all([captureSelection(), frontmostApp()]);
  const existing = currentWidget();
  const win = getOrCreateWidget();
  const windowId = win.id;
  if (!existing) {
    // Fresh panel — seed the default tab; auto-start runs once the renderer is ready.
    clearPanelSessions();
    activeTabId = '1';
    tabSessions.set(activeTabId, makeSession(activeTabId, code, sourceApp));
    win.on('closed', () => {
      clearPanelSessions();
      normalBounds.delete(windowId);
      hideBar(bar);
    });
    return;
  }
  beginCaptureOnActiveTab(win, code, sourceApp);
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
  if (isMac) {
    // Keep Unvibe in the Dock / Cmd-Tab list (not a menu-bar-only accessory).
    app.dock?.show();
    if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
  }

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
  tray.on('click', () => openCompanion());

  bar = createBar();
  setBar(bar);
  positionBar(bar);
  // Keep the aisle hidden until ⌘U / Review — less distraction.
  hideBar(bar);
  registerShortcut(s.shortcut);
  // Companion home keeps the app visible in Dock / Cmd-Tab on launch.
  openCompanion();

  // --- bar / companion ---
  ipcMain.on('bar:review', () => void startReview());
  ipcMain.on('bar:openCompanion', () => openCompanion());
  ipcMain.on('companion:review', () => void startReview());

  // --- widget lifecycle (single panel + tabs) ---
  ipcMain.on('widget:ready', (e) => {
    const win = widgetOf(e);
    if (!win) return;
    panelReady = true;
    const session = sessionFor(activeTabId);
    if (!session) return;
    initWidget(win, session, { autoStart: Boolean(session.code) });
    if (session.code) void runReview(win, session, { level: session.level });
  });
  ipcMain.on('widget:setActiveTab', (_e, tabId: string) => {
    if (typeof tabId !== 'string' || !tabId) return;
    activeTabId = tabId;
    if (!tabSessions.has(tabId)) tabSessions.set(tabId, makeSession(tabId, null, null));
  });
  ipcMain.on('widget:addTab', (e, tabId: string) => {
    const win = widgetOf(e);
    if (!win || typeof tabId !== 'string' || !tabId) return;
    activeTabId = tabId;
    const session = makeSession(tabId, null, null);
    tabSessions.set(tabId, session);
    initWidget(win, session, { autoStart: false });
  });
  ipcMain.on('widget:closeTab', (e, tabId: string) => {
    const win = widgetOf(e);
    if (!win || typeof tabId !== 'string') return;
    const closing = tabSessions.get(tabId);
    closing?.abort?.abort();
    tabSessions.delete(tabId);
    if (tabSessions.size === 0) {
      win.close();
      return;
    }
    if (activeTabId === tabId) {
      activeTabId = [...tabSessions.keys()][0]!;
      const next = sessionFor(activeTabId);
      if (next) initWidget(win, next, { autoStart: false });
    }
  });
  ipcMain.on('widget:request', (e, opts: RequestOpts) => {
    const win = widgetOf(e);
    const session = sessionFor(activeTabId);
    if (win && session) void runReview(win, session, opts);
  });
  ipcMain.on('widget:useClipboard', (e, opts: { level?: ExplanationLevel }) => {
    const win = widgetOf(e);
    const session = sessionFor(activeTabId);
    if (!win || !session) return;
    const text = clipboard.readText().trim();
    if (!text) {
      // Stay on the calm picker — don't surface an error.
      initWidget(win, session, { autoStart: false });
      return;
    }
    loadCodeIntoSession(win, session, text, 'Clipboard', opts?.level);
  });
  ipcMain.handle('widget:pickFile', async (e, opts?: { level?: ExplanationLevel }) => {
    const win = widgetOf(e);
    const session = sessionFor(activeTabId);
    if (!win || !session) return { ok: false as const };
    const picked = await dialog.showOpenDialog(win, {
      title: 'Choose a file to explain',
      message: 'Pick a source file from your project',
      properties: ['openFile'],
      filters: [
        {
          name: 'Code',
          extensions: [
            'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'kt', 'swift',
            'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'rb', 'php', 'md', 'json', 'css', 'scss',
            'html', 'sql', 'sh', 'zsh', 'yml', 'yaml', 'toml',
          ],
        },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (picked.canceled || !picked.filePaths[0]) return { ok: false as const, cancelled: true as const };
    const filePath = picked.filePaths[0];
    let text: string;
    try {
      const buf = await readFile(filePath);
      if (buf.byteLength > MAX_PICK_BYTES) {
        return { ok: false as const, error: 'That file is a bit large — pick a smaller source file (under ~200KB).' };
      }
      text = buf.toString('utf8').trim();
    } catch {
      return { ok: false as const, error: 'Could not read that file.' };
    }
    if (!text) return { ok: false as const, error: 'That file looks empty.' };
    const root = await resolveRepoRoot(path.dirname(filePath));
    const rel = root ? path.relative(root, filePath) : path.basename(filePath);
    const usage = await resolveAppUsage();
    try {
      const built = await buildSelectionPayload({
        code: text,
        level: opts?.level ?? session.level,
        filePath,
        repoRoot: root,
        withNearby: isProPlan(usage.plan),
      });
      session.abort?.abort();
      session.sourceApp = path.basename(filePath);
      session.reviewId = randomUUID();
      applyBuiltReview(session, built);
      session.file = rel;
      session.project = built.project;
      initWidget(win, session, { autoStart: true });
      void runReview(win, session, { level: session.level });
    } catch {
      loadCodeIntoSession(win, session, text, path.basename(filePath), opts?.level, {
        file: rel,
        project: root ? path.basename(root) : undefined,
        sourceFilePath: filePath,
      });
    }
    return { ok: true as const };
  });
  ipcMain.on('widget:usePaste', (e, payload: { text?: string; level?: ExplanationLevel }) => {
    const win = widgetOf(e);
    const session = sessionFor(activeTabId);
    if (!win || !session) return;
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      initWidget(win, session, { autoStart: false });
      return;
    }
    loadCodeIntoSession(win, session, text, 'Pasted code', payload?.level);
  });
  ipcMain.on('widget:cancel', (e) => {
    const win = widgetOf(e);
    const session = sessionFor(activeTabId);
    if (!win || !session) return;
    session.abort?.abort();
    win.webContents.send('review:event', { type: 'cancelled', tabId: session.tabId });
  });
  ipcMain.on('widget:testMe', (e) => {
    const win = widgetOf(e);
    const session = sessionFor(activeTabId);
    if (win && session) void startComprehension(win, session);
  });
  ipcMain.on('widget:answer', (e, choice: number) => {
    const win = widgetOf(e);
    const session = sessionFor(activeTabId);
    if (win && session) gradeComprehension(win, session, choice);
  });
  ipcMain.on('widget:gotIt', (e) => {
    const win = widgetOf(e);
    const session = sessionFor(activeTabId);
    if (win && session) markUnderstood(win, session);
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
  ipcMain.handle('learning:history', (_e, limit: number) => computeLearningItems(store().events(), Math.max(1, Math.min(limit ?? 100, 250))));
  ipcMain.handle('learning:queue', (_e, limit: number) => computeReviewQueue(store().events(), new Date(), Math.max(1, Math.min(limit ?? 20, 50))));

  ipcMain.handle('project:pickRoot', async () => {
    const picked = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
    const root = await resolveRepoRoot(picked.filePaths[0]);
    if (!root) return { ok: false, error: 'That folder is not a git repository.' };
    return { ok: true, root };
  });

  ipcMain.handle('review:explainDiff', async (e, opts?: { brief?: boolean; level?: ExplanationLevel }) => {
    const win = widgetOf(e) ?? getOrCreateWidget();
    showBar(bar);
    const session = sessionFor() ?? makeSession(activeTabId, null, null, opts?.level ?? 'intermediate');
    tabSessions.set(activeTabId, session);
    if (opts?.level) session.level = opts.level;
    let root = await resolveRepoRoot();
    if (!root) {
      const picked = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Choose a git project' });
      if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
      root = await resolveRepoRoot(picked.filePaths[0]);
    }
    if (!root) return { ok: false, error: 'Pick a git repository to explain changes.' };
    const brief = Boolean(opts?.brief);
    const feature = brief ? 'Agent change briefs' : 'Git diff explanations';
    if (!(await requireProOrError(win, session, feature))) {
      return { ok: false, error: 'Pro required' };
    }
    return startBuiltReview(
      win,
      session,
      () => buildDiffPayload({ repoRoot: root!, level: session.level, mode: brief ? 'brief' : 'diff' }),
      brief ? 'Agent brief' : 'Git diff',
    );
  });

  ipcMain.handle('review:explainCompare', async (e, opts?: { level?: ExplanationLevel }) => {
    const win = widgetOf(e) ?? getOrCreateWidget();
    showBar(bar);
    const session = sessionFor() ?? makeSession(activeTabId, null, null, opts?.level ?? 'intermediate');
    tabSessions.set(activeTabId, session);
    if (opts?.level) session.level = opts.level;
    if (!(await requireProOrError(win, session, 'Since last understood'))) {
      return { ok: false, error: 'Pro required' };
    }
    const picked = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Choose a file to compare with what you last understood',
    });
    if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
    return startBuiltReview(
      win,
      session,
      () => buildComparePayload({ filePath: picked.filePaths[0]!, level: session.level }),
      'Compare',
    );
  });

  ipcMain.handle('review:reopenItem', async (_e, item: { file?: string; project?: string; level?: string }) => {
    const win = getOrCreateWidget();
    showBar(bar);
    const session = sessionFor() ?? makeSession(activeTabId, null, null, (item.level as ExplanationLevel) || 'intermediate');
    tabSessions.set(activeTabId, session);
    if (!item.file) {
      beginCaptureOnActiveTab(win, null, null);
      return { ok: true };
    }
    let root = await resolveRepoRoot();
    if (item.project && (!root || path.basename(root) !== item.project)) {
      const picked = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: `Locate project “${item.project}”`,
      });
      if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
      root = await resolveRepoRoot(picked.filePaths[0]);
      if (!root || (item.project && path.basename(root) !== item.project)) {
        return { ok: false, error: `That folder does not look like the “${item.project}” project.` };
      }
    }
    const abs = root ? path.join(root, item.file) : item.file;
    try {
      const text = await readFile(abs, 'utf8');
      if (text.length > MAX_PICK_BYTES) return { ok: false, error: 'That file is too large to reopen here.' };
      const usage = await resolveAppUsage();
      const built = await buildSelectionPayload({
        code: text,
        level: session.level,
        filePath: abs,
        repoRoot: root,
        withNearby: isProPlan(usage.plan),
      });
      applyBuiltReview(session, built);
      session.sourceApp = 'Study';
      session.reviewId = randomUUID();
      initWidget(win, session, { autoStart: true });
      void runReview(win, session, { level: session.level });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not reopen that file. Open Study again and locate the project folder when prompted.' };
    }
  });
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
    void shell.openExternal('https://unvibe.site/privacy');
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
  ipcMain.handle('billing:overview', async () => {
    const token = store().token();
    if (!token) return { ok: false, error: 'Sign in to view your plan and cloud usage.' };
    try { return { ok: true, data: await billingOverview(token) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Could not load plan.' }; }
  });
  ipcMain.handle('usage:get', async () => {
    try { return { ok: true, data: await resolveAppUsage() }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Could not load usage.' }; }
  });
  ipcMain.handle('ai:keyStatus', () => ({ ok: true, data: aiKeyStatus() }));
  ipcMain.handle('ai:setKey', (_e, key: string) => {
    try { writeAiKey(String(key ?? '')); return { ok: true, data: aiKeyStatus() }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Could not save the API key.' }; }
  });
  ipcMain.handle('ai:clearKey', () => { clearAiKey(); return { ok: true, data: aiKeyStatus() }; });
  ipcMain.handle('ai:costOverview', (_e, provider?: 'gemini' | 'anthropic') => {
    const p = provider === 'anthropic' ? 'anthropic' : settings().all().aiProvider;
    return { ok: true, data: costOverview(p) };
  });
  ipcMain.handle('billing:checkout', async (_e, input: { plan: 'pro' | 'teams'; interval: 'monthly' | 'annual'; seats: number; workspaceId?: string; workspaceName?: string }) => {
    const token = store().token();
    if (!token) return { ok: false, error: 'Sign in before starting checkout.' };
    try { const url = await startBillingCheckout(token, input); await shell.openExternal(url); return { ok: true }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Checkout could not start.' }; }
  });
  ipcMain.handle('billing:portal', async (_e, workspaceId: string) => {
    const token = store().token();
    if (!token) return { ok: false, error: 'Sign in before managing billing.' };
    try { const url = await startBillingPortal(token, workspaceId); await shell.openExternal(url); return { ok: true }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Billing could not open.' }; }
  });
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
    const panel = currentWidget();
    if (panel && !panel.isDestroyed()) panel.close();
    clearPanelSessions();
    return { ok: true };
  });
});

app.on('browser-window-focus', () => void flush());
app.on('activate', () => {
  // Dock / Cmd-Tab selection — bring the home window back.
  openCompanion();
});
app.on('will-quit', () => {
  stopSync();
  globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => {
  /* keep the agent alive — tray + dock stay until Quit */
});
