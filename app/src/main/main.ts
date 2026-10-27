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
  Notification,
  Tray,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  powerMonitor,
  screen,
  shell,
  systemPreferences,
} from 'electron';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { userInfo } from 'node:os';
import {
  applyWidgetResize,
  createBar,
  createCompanion,
  currentWidget,
  getOrCreateWidget,
  hideBar,
  positionBar,
  raiseLimitPause,
  resizeBar,
  showBar,
  type WidgetResizeEdge,
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
import { onLearningChanged, store, type ChatThread } from './store';
import { applyLoginItem, loginItemState, settings, type Settings } from './settings';
import { capGiftUsed, giftCodeFromInput, GIFT_LIMIT } from './gift';
import { deviceVerificationUrl } from '../core/deviceAuth';
import { isLevelAnswer, levelAfterAnswer } from '../core/levelAnswer';
import { isLoginLaunch, launchOpensWindow, loginItemFallback, loginPromptStep } from '../core/loginItem';
import { grantReturnApp, type PendingGrant } from '../core/grantReturn';
import { isBillingUrl } from '../core/permissions';
import { fullProductBuildEnabled, trialBuildEnabled } from './trial';
import { reportProgress, syncProgress } from './progress';
import { flush, onSyncStatus, retrySync, stopSync, syncStatus } from './sync';
import {
  signIn,
  signUp,
  signOut as revokeSession,
  startDeviceAuth,
  redeemDeviceAuth,
  accountInfo,
  billingOverview,
  billingStatus,
  startBillingCheckout,
  startBillingPortal,
  giftProgress,
  claimGiftCode,
  type Account as BackendAccount,
  warmBackend,
  networkFetch,
} from './backend';
import { setBar, notify, pulseBar } from './notify';
import { computeProfile, computeFeed, computeLearningItems, computeReviewQueue, localDayKey } from '../core/learning';
import { sendFeedback, type FeedbackInput } from './feedback';
import { cachedAppUsage, invalidateAppUsage, refreshAppUsage, resolveAppUsage } from './usage';
import { installHardening } from './hardening';
import { aiKeyStatus, clearAiKey, writeAiKey } from './aiKey';
import {
  costOverview,
  guessProviderFromKey,
  listLocalAiProviders,
  normalizeLocalAiProvider,
  type LocalAiProviderId,
} from './localAi';
import {
  buildComparePayload,
  buildDiffPayload,
  buildSelectionPayload,
  resolveRepoRoot,
} from './contextBuilder';
import { isProPlan } from '../core/plans';
import { answerQuizCard, askChat, askStudyAssistant, quizCardStatus, saveChatThread, startQuizCard, studyAskStatus } from './studyQuiz';
import { installDesktopBridge, integrationStatus } from './integrations';
import { startLiveWatch } from './liveWatch';
import { checkForUpdate, cleanupPortableUpdate, installUpdate, isNewer } from './updater';
import { knowledgeStore } from './knowledgeStore';
import { deleteAccountAndLocalData } from './accountDeletion';
import { buildChangeBrief, type BriefScope } from '../core/changeBrief';
import { buildOriginReport } from '../core/codeOrigin';
import { gradeTeachBack } from '../core/teachBack';
import { capHunks, collectDiffHunks, blameRange, fileHistory, gitHeadState, readRepoFile } from '../core/gitDiff';
import { productEvent } from '../core/productEvents';

function osUserName(): string {
  try {
    return userInfo().username;
  } catch {
    return '';
  }
}

function firstName(): Promise<string> {
  // `id -F` (full name) only exists on macOS.
  if (process.platform !== 'darwin') {
    return Promise.resolve(osUserName() || process.env.USERNAME || process.env.USER || 'there');
  }
  return new Promise((resolve) => {
    execFile('id', ['-F'], { timeout: 1500 }, (err, stdout) => {
      const full = err ? '' : stdout.trim();
      resolve(full.split(/\s+/)[0] || process.env.USER || 'there');
    });
  });
}

function greetingName(osName: string): string {
  const saved = (settings().all().displayName ?? '').trim();
  if (saved) return saved.split(/\s+/)[0];
  return osName;
}

const todayKey = () => localDayKey(new Date());
const isMac = process.platform === 'darwin';

let tray: Tray | null = null;
let bar: BrowserWindow | null = null;
let companion: BrowserWindow | null = null;
let devicePoll: NodeJS.Timeout | null = null;
let currentDeviceVerificationUrl: string | null = null;
/** Per-tab review sessions inside the single shared panel. */
const tabSessions = new Map<string, ReviewSession>();
let activeTabId = '1';
let panelReady = false;
const normalBounds = new Map<number, Electron.Rectangle>();
let pendingExternalReview: { preferClipboard: boolean } | null = null;

/**
 * The IDE bridge deliberately carries no code. The desktop app captures the current selection
 * locally through a trusted, on-device clipboard handoff, so a selection never appears in a
 * URL, log, extension setting, or third-party process.
 */
function parseExternalReviewUrl(rawUrl: string): { preferClipboard: boolean } | null {
  try {
    const url = new URL(rawUrl);
    const isReview = url.protocol === 'unvibe:' && url.hostname === 'review' &&
      (url.pathname === '' || url.pathname === '/') && url.hash === '';
    if (!isReview) return null;
    // This is an intent flag only — a URL must never contain selected source text.
    if (url.search === '') return { preferClipboard: false };
    if (url.searchParams.size === 1 && url.searchParams.get('source') === 'ide') {
      return { preferClipboard: true };
    }
    return null;
  } catch {
    return null;
  }
}

function handleExternalReviewUrl(rawUrl: string): void {
  const request = parseExternalReviewUrl(rawUrl);
  if (!request) return;
  if (app.isReady()) void startReview(request);
  else pendingExternalReview = request;
}

function makeSession(
  tabId: string,
  code: string | null,
  sourceApp: string | null,
  level: ExplanationLevel = settings().all().defaultExplanationLevel,
): ReviewSession {
  const session: ReviewSession = {
    reviewId: randomUUID(),
    tabId,
    code,
    sourceApp,
    abort: null,
    recorded: false,
    level,
    isSample: () => session.code === FIRST_RUN_SAMPLE,
    onRecorded: () => {
      notify('Added to your learning history');
      // First run step 2 asks its one level question once the sample answer has finished.
      if (session.isSample?.() && companion && !companion.isDestroyed()) companion.webContents.send('onboarding:sampleDone');
      void askLaunchAtLogin(!session.isSample?.());
    },
    onUnderstood: () => notify('Nice — concept understood'),
  };
  return session;
}

/** Launch at login, asked once after the user's first explanation of their own code (first-run spec). */
async function askLaunchAtLogin(ownCode: boolean): Promise<void> {
  const step = loginPromptStep({
    ownCode,
    asked: store().loginPromptAsked(),
    launchAtLogin: () => settings().all().launchAtLogin || loginItemState().openAtLogin,
  });
  if (step === 'none') return;
  store().markLoginPromptAsked();
  if (step === 'settle') return;
  reportProgress('login_prompt_shown');
  const question: Electron.MessageBoxOptions = {
    type: 'question',
    buttons: ['Yes', 'No'],
    defaultId: 0,
    cancelId: 1,
    message: 'Open Unvibe when you log in, so the shortcut is ready?',
    detail: 'You can turn this off in Settings.',
  };
  const panel = currentWidget();
  const { response } = panel && !panel.isDestroyed()
    ? await dialog.showMessageBox(panel, question)
    : await dialog.showMessageBox(question);
  if (response !== 0) return;
  settings().set({ launchAtLogin: true });
  reportProgress('login_prompt_accepted');
  const fallback = loginItemFallback(process.platform, loginItemState());
  if (fallback) await dialog.showMessageBox({ type: 'info', buttons: ['OK'], message: fallback });
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

/**
 * The review panel, opened if needed. A fresh panel starts with no tab sessions, and the session the
 * caller then puts on its active tab is started once by the renderer's widget:ready, never twice.
 */
function openPanel(): { win: BrowserWindow; fresh: boolean } {
  if (currentWidget()) return { win: getOrCreateWidget(), fresh: false };
  const win = getOrCreateWidget();
  const windowId = win.id;
  clearPanelSessions();
  win.on('closed', () => {
    clearPanelSessions();
    normalBounds.delete(windowId);
    if (settings().all().barVisibility === 'during-review') hideBar(bar);
  });
  return { win, fresh: true };
}

function beginCaptureOnActiveTab(
  win: BrowserWindow,
  code: string | null,
  sourceApp: string | null,
): void {
  const prev = sessionFor(activeTabId);
  prev?.abort?.abort();
  // Keep the depth chosen in this tab; a fresh tab starts at the Settings default (makeSession's default).
  const session = makeSession(activeTabId, code, sourceApp, prev?.level);
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

/** True on Pro. Otherwise the panel, when given, shows the upgrade prompt; callers return 'Pro required'. */
async function requireProOrError(win: BrowserWindow | null, tabId: string, feature: string): Promise<boolean> {
  const usage = await resolveAppUsage();
  if (isProPlan(usage.plan)) return true;
  win?.webContents.send('review:event', {
    type: 'error',
    tabId,
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
    pulseBar({ phase: 'contextualizing', label: 'Contextualizing' });
    const built = await builder();
    session.abort?.abort();
    session.sourceApp = sourceLabel;
    session.reviewId = randomUUID();
    applyBuiltReview(session, built);
    // A panel that is still loading starts this tab itself on widget:ready.
    if (!panelReady) return { ok: true };
    initWidget(win, session, { autoStart: true });
    void runReview(win, session, { level: session.level });
    return { ok: true };
  } catch (err) {
    pulseBar({ phase: 'error', label: 'Issue' });
    return { ok: false, error: err instanceof Error ? err.message : 'Could not start that review.' };
  }
}

onSyncStatus((status) => {
  if (companion && !companion.isDestroyed()) companion.webContents.send('sync:status', status);
});

// Lessons saved from the panel, sync or the Library show in a companion that stays open but unfocused.
onLearningChanged(() => {
  if (companion && !companion.isDestroyed()) companion.webContents.send('learning:changed');
});

async function persistAccount(account: BackendAccount): Promise<void> {
  invalidateAppUsage();
  try {
    store().setAccount(account.userId, account.email, account.token);
    reportProgress('signed_in');
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

/** True when macOS lets Unvibe read selections. The first true is reported as setup progress. */
function accessibilityGranted(prompt = false): boolean {
  if (!isMac) return true;
  const granted = systemPreferences.isTrustedAccessibilityClient(prompt);
  if (granted) reportProgress('accessibility');
  return granted;
}

/**
 * Release builds are signed with the same certificate every time, so the designated requirement
 * stays the same across updates (identical in v0.1.42 and v0.1.43, unsigned-install research
 * 2026-10-22) and macOS should keep the Accessibility grant. Local ad-hoc builds still change
 * identity, and macOS can then keep an entry that looks on but no longer applies. So, as a
 * fallback: after an update, if access was lost, clear the stale entry and ask again once, with a
 * clear note instead of a silent failure.
 */
function repairAccessibilityAfterUpdate(): void {
  if (!isMac) return;
  const file = path.join(app.getPath('userData'), 'last-run-version.txt');
  let last = '';
  try { last = readFileSync(file, 'utf8').trim(); } catch { /* first run */ }
  const current = app.getVersion();
  try { writeFileSync(file, current); } catch { /* still repair this launch */ }
  if (!last || last === current || accessibilityGranted(false)) return;
  execFile('tccutil', ['reset', 'Accessibility', 'com.unvibe.app'], () => {
    accessibilityGranted(true);
    notify('Unvibe updated. Switch Unvibe on in Accessibility once more so the shortcut can read your selection.');
  });
}

let quitting = false;
app.on('before-quit', () => {
  quitting = true;
});

function openCompanion(): void {
  // Always keep a Dock icon on macOS so Unvibe can be clicked like any other app.
  if (isMac) void app.dock?.show();
  if (companion && !companion.isDestroyed()) {
    if (companion.isMinimized()) companion.restore();
    companion.show();
    companion.focus();
    return;
  }
  companion = createCompanion();
  const win = companion;
  // On Windows and Linux the taskbar button belongs to the window, so closing it would make
  // Unvibe vanish into the tray. Minimize instead so it always stays clickable in the taskbar.
  if (!isMac) {
    win.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      win.minimize();
    });
  }
  win.on('closed', () => {
    if (companion === win) companion = null;
  });
}

function openCompanionPage(page: string): void {
  openCompanion();
  const send = () => {
    if (companion && !companion.isDestroyed()) companion.webContents.send('companion:showPage', page);
  };
  if (companion && companion.webContents.isLoading()) companion.webContents.once('did-finish-load', send);
  else send();
}

function allowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return parsed.hostname === 'unvibe.site'
      || parsed.hostname === 'unvibe.live'
      || parsed.hostname === '5fmnqm5vw5o.typeform.com';
  } catch {
    return false;
  }
}

function broadcastShortcut(): void {
  if (companion && !companion.isDestroyed()) companion.webContents.send('shortcut:fired');
}

function asset(...parts: string[]): string {
  return path.join(__dirname, '..', 'assets', ...parts);
}

/** First-run sample. Kept in the main process so the renderer can't send arbitrary code this way. */
const FIRST_RUN_SAMPLE = [
  'function debounce(fn, wait) {',
  '  let timer;',
  '  return (...args) => {',
  '    clearTimeout(timer);',
  '    timer = setTimeout(() => fn(...args), wait);',
  '  };',
  '}',
].join('\n');

/**
 * The app a shortcut press came from while macOS had not allowed Accessibility yet, and when. Once
 * the grant shows up, the panel asks main to go back there and explain the selection already made;
 * `grantReturnApp` drops presses older than five minutes (Security L2).
 */
let pendingGrant: PendingGrant | null = null;

async function startReview(options: { preferClipboard?: boolean; sample?: boolean; captured?: { code: string; sourceApp: string } } = {}): Promise<void> {
  broadcastShortcut();
  pulseBar({ phase: 'loading', label: 'Loading' });
  // A recent snapshot keeps ⌘U instant; the server still enforces the real limit.
  const usage = await cachedAppUsage();
  if (usage.remaining <= 0) {
    pulseBar({ phase: 'error', label: 'Limit reached' });
    showBar(bar);
    const win = getOrCreateWidget();
    raiseLimitPause(win);
    win.webContents.send('review:event', {
      type: 'usage',
      tabId: '1',
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      resetsAt: usage.resetsAt,
      plan: usage.plan,
    });
    win.webContents.send('review:event', {
      type: 'error',
      tabId: '1',
      code: 'plan_limit_reached',
      upgradePath: '/plan',
      message: 'You have reached your monthly explanation limit.',
    });
    return;
  }
  // The macOS TCC preflight can report a false negative for a freshly rebuilt,
  // locally installed app even after its Accessibility switch is enabled. Try
  // the on-device capture first; System Events is the real permission boundary.
  // This prevents ⌘U from trapping someone in System Settings when capture is
  // already allowed.
  // Capture before showing any Unvibe surface. This preserves the active editor selection
  // for the global shortcut, while the IDE bridge uses its just-written local clipboard text.
  const capture = options.sample
    ? { code: FIRST_RUN_SAMPLE, sourceApp: 'Unvibe' }
    : options.captured ?? await captureSelection(options);
  const code = capture.code;
  // Windows capture already looked up the foreground app in the same PowerShell call.
  const sourceApp = capture.sourceApp !== undefined ? capture.sourceApp : await frontmostApp();
  if (!code) pulseBar({ phase: 'error', label: 'Select code first' });
  // A clipboard explain (onboarding's button or the IDE link) with nothing copied: say so,
  // instead of leaving the panel to guess why.
  if (!code && options.preferClipboard) notify('Your clipboard is empty. Copy some code first, then try again.');
  if (!code && process.platform === 'win32' && !options.preferClipboard) {
    // macOS explains a missing Accessibility grant in the panel; on Windows say what happened.
    const from = sourceApp && !/unvibe|^electron$/i.test(sourceApp) ? sourceApp : 'that app';
    notify(`Couldn't copy from ${from}. Select the code and press the shortcut again, or use Explain my clipboard.`);
  }
  if (!code && isMac && !options.preferClipboard && !accessibilityGranted(false)) {
    // The panel shows the pre-permission screen (Continue asks; clipboard and file work without it).
    reportProgress('accessibility_asked');
    pendingGrant = sourceApp && !/unvibe|^electron$/i.test(sourceApp) ? { app: sourceApp, at: Date.now() } : null;
  }
  // Aisle + review panel only appear when you invoke a review (⌘U / start).
  showBar(bar);
  if (code && trialBuildEnabled() && !fullProductBuildEnabled()) {
    const quota = store().consumeBetaSelectedCodePrompt();
    if (!quota.ok) {
      notify(`Your 30-day beta includes ${store().betaSelectedCodeUsage().limit} selected-code prompts. Your saved learning is still available.`);
      return;
    }
  }
  const { win, fresh } = openPanel();
  if (fresh) {
    // Fresh panel — seed the default tab; auto-start runs once the renderer is ready.
    tabSessions.set(activeTabId, makeSession(activeTabId, code, sourceApp));
    return;
  }
  beginCaptureOnActiveTab(win, code, sourceApp);
}

function registerShortcut(accel: string): boolean {
  globalShortcut.unregisterAll();
  // ⌃U is a spare chord on macOS (the IDE bridge owns ⌘U). On Windows Ctrl+U is the
  // bridge's own key and a common app shortcut, so only the user's choice is grabbed there.
  const keys = new Set<string>(isMac ? [accel, 'Control+U'] : [accel]);
  let any = false;
  for (const key of keys) {
    try {
      if (globalShortcut.register(key, () => void startReview())) any = true;
    } catch {
      /* shortcut taken by another app */
    }
  }
  return any;
}

function widgetOf(e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender);
}

app.setName('Unvibe');
// Development and QA only: run against a throwaway profile instead of the real learning data.
if (process.env.UNVIBE_USER_DATA) app.setPath('userData', process.env.UNVIBE_USER_DATA);
installHardening();
// Windows only shows toasts for apps with an explicit AppUserModelID matching the installer.
if (process.platform === 'win32') app.setAppUserModelId('com.unvibe.app');

// One process owns the global fallback shortcut and the `unvibe://` protocol. Without this,
// two copies (for example, one in Applications and one opened from a mounted DMG) can race for
// ⌘U and leave a review panel open with no captured selection.
// The lock carries this copy's version and path so an older running copy can hand over to it.
const hasSingleInstanceLock = app.requestSingleInstanceLock({ version: app.getVersion(), execPath: process.execPath });
if (!hasSingleInstanceLock) app.quit();
/** Windows and Linux deliver `unvibe://` links as command-line arguments, not via open-url. */
function protocolUrlFrom(argv: readonly string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().startsWith('unvibe://')) ?? null;
}

app.on('second-instance', (_event, argv, _cwd, additionalData) => {
  // A newer Unvibe was just opened while this older one runs: step aside and start the new one.
  const incoming = additionalData as { version?: unknown; execPath?: unknown } | undefined;
  if (typeof incoming?.version === 'string' && typeof incoming.execPath === 'string' && isNewer(incoming.version, app.getVersion())) {
    app.relaunch({ execPath: incoming.execPath, args: [] });
    quitting = true;
    app.exit(0);
    return;
  }
  const url = protocolUrlFrom(argv);
  if (url) handleExternalReviewUrl(url);
  else openCompanion();
});

// A protocol link can also cold-start the app on Windows; macOS uses open-url for this.
if (!isMac) {
  const launchUrl = protocolUrlFrom(process.argv);
  if (launchUrl) handleExternalReviewUrl(launchUrl);
}

// Register before Electron becomes ready: macOS can deliver an open-url event during launch.
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleExternalReviewUrl(url);
});

// CFBundleURLTypes below registers packaged builds. A dev launch (npm start, electron .) would
// otherwise re-point every unvibe:// link on the machine at the bare Electron binary, so local
// development registers only when asked: UNVIBE_DEV_PROTOCOL=1.
if (process.defaultApp) {
  const entry = process.argv[1];
  if (entry && process.env.UNVIBE_DEV_PROTOCOL === '1') app.setAsDefaultProtocolClient('unvibe', process.execPath, [path.resolve(entry)]);
} else {
  app.setAsDefaultProtocolClient('unvibe');
}

app.whenReady().then(() => {
  cleanupPortableUpdate();
  // Open the backend connection and fetch usage early so the first explanation starts faster.
  setTimeout(() => {
    warmBackend();
    // The usage check creates the server's install row, so setup progress goes after it.
    void refreshAppUsage().catch(() => undefined).finally(() => void syncProgress({
      onboarded: settings().all().onboarded,
      accessibilityGranted: isMac && accessibilityGranted(false),
      signedIn: Boolean(store().token()),
    }));
  }, 1200);
  powerMonitor.on('resume', warmBackend);
  powerMonitor.on('unlock-screen', warmBackend);
  // A UI/settings migration may re-show setup, but an app update must never erase learning.
  settings().takeFreshStart();
  store();
  const s = settings().all();
  applyLoginItem(s.launchAtLogin);
  void flush();
  startFrontmostWatch();
  startLiveWatch();

  const dockIcon = nativeImage.createFromPath(asset('icon.png'));
  if (isMac) {
    // Keep Unvibe in the Dock / Cmd-Tab list (not a menu-bar-only accessory).
    app.dock?.show();
    if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
  }

  // The black template image only suits the macOS menu bar; the Windows tray gets the colour icon.
  let trayImage = process.platform === 'win32' && !dockIcon.isEmpty()
    ? dockIcon.resize({ width: 16, height: 16 })
    : nativeImage.createFromPath(asset('trayTemplate.png'));
  if (trayImage.isEmpty()) trayImage = dockIcon.resize({ width: 18, height: 18 });
  else if (isMac) trayImage.setTemplateImage(true);
  tray = new Tray(trayImage);
  tray.setIgnoreDoubleClickEvents(true);
  tray.setToolTip('Unvibe');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Explain selected code', click: () => void startReview() },
      { label: 'Open Unvibe', click: openCompanion },
      { type: 'separator' },
      { label: 'Show learning island', click: () => showBar(bar) },
      { label: 'Hide learning island', click: () => hideBar(bar) },
      { type: 'separator' },
      { label: 'Quit Unvibe', role: 'quit' },
    ]),
  );
  tray.on('click', () => openCompanion());

  bar = createBar();
  setBar(bar);
  positionBar(bar);
  if (s.onboarded && s.barVisibility === 'always') showBar(bar);
  else hideBar(bar);

  // Keep the learning strip correctly placed and above full-screen Spaces after display changes.
  const restoreFloatingWindows = () => {
    if (bar && !bar.isDestroyed() && bar.isVisible()) showBar(bar);
    const panel = currentWidget();
    if (!panel || panel.isDestroyed()) return;
    panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    panel.moveTop();
  };
  screen.on('display-added', restoreFloatingWindows);
  screen.on('display-removed', restoreFloatingWindows);
  screen.on('display-metrics-changed', restoreFloatingWindows);
  if (!registerShortcut(s.shortcut)) {
    notify('That shortcut is in use by another app. Pick a different one in Settings.');
  }
  // Companion home keeps the app visible in Dock / Cmd-Tab on launch. A login launch after setup
  // starts quietly in the tray instead, so the shortcut is ready with no window.
  const loginLaunch = isLoginLaunch(process.platform, process.argv, isMac && loginItemState().wasOpenedAtLogin);
  if (launchOpensWindow(loginLaunch, s.onboarded)) openCompanion();
  repairAccessibilityAfterUpdate();
  if (pendingExternalReview) {
    const request = pendingExternalReview;
    pendingExternalReview = null;
    void startReview(request);
  }

  // --- bar / companion ---
  ipcMain.on('bar:review', () => void startReview());
  ipcMain.on('bar:openCompanion', () => openCompanion());
  ipcMain.on('bar:openSettings', () => openCompanionPage('Settings'));
  ipcMain.on('bar:setExpanded', (_e, expanded: boolean) => {
    // Click and keyboard expansion remain available when hover expansion is off.
    // The renderer decides whether a pointer entering the Island requests this.
    resizeBar(bar, Boolean(expanded));
  });
  ipcMain.on('bar:contextMenu', (_e, state: { hasRecent?: boolean }) => {
    if (!bar || bar.isDestroyed()) return;
    Menu.buildFromTemplate([
      { label: 'Explain selected code', click: () => void startReview() },
      ...(state.hasRecent ? [{ label: 'Open last explanation', click: openCompanion }] : []),
      { type: 'separator' },
      { label: 'Open Unvibe', click: openCompanion },
      { label: 'Settings', click: () => openCompanionPage('Settings') },
      { label: 'Hide Island', click: () => hideBar(bar) },
      { type: 'separator' },
      { label: 'Quit Unvibe', role: 'quit' },
    ]).popup({ window: bar });
  });
  ipcMain.handle('bar:snapshot', async () => {
    const recent = computeLearningItems(store().events(), 1)[0];
    const profile = computeProfile(store().events(), todayKey());
    let quota = { used: 0, limit: 30, remaining: 30 };
    let selections = { used: 0, limit: 30, remaining: 30 };
    try {
      const appUsage = await cachedAppUsage();
      quota = { used: appUsage.used, limit: appUsage.limit, remaining: appUsage.remaining };
      selections = store().betaSelectedCodeUsage();
    } catch { /* keep local defaults */ }
    return {
      shortcut: settings().all().shortcut,
      recent: recent ? { id: recent.id, title: recent.title, detail: recent.meta, level: recent.level } : null,
      streak: profile.streak,
      explanations: profile.reviews,
      understood: profile.understood,
      needsReview: profile.needsReview,
      linesUnderstood: profile.linesUnderstood,
      conceptsSeen: profile.conceptsSeen,
      conceptsStrong: profile.conceptsStrong,
      usage: profile.usage[0] ?? null,
      quota,
      selections,
      heat: profile.heat.slice(-14),
    };
  });
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
    const usage = await cachedAppUsage();
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
    win.setAlwaysOnTop(true, pinned ? 'screen-saver' : 'pop-up-menu');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    if (isMac) win.setHiddenInMissionControl(true);
    win.moveTop();
  });
  ipcMain.on('widget:collapse', (e, collapsed: boolean) => {
    const win = widgetOf(e);
    if (!win) return;
    endWidgetResize();
    if (collapsed) {
      normalBounds.set(win.id, win.getBounds());
      win.setBounds({ ...win.getBounds(), height: 52 });
    } else {
      const prev = normalBounds.get(win.id);
      if (prev) win.setBounds(prev);
    }
  });
  ipcMain.on('widget:close', (e) => widgetOf(e)?.close());
  ipcMain.on('widget:openStudy', () => openCompanion());
  ipcMain.on('companion:openPlan', () => openCompanionPage('Plan'));

  // Border-aligned resize (grips sit on the visible card edges, not an invisible outer rim).
  let resizeTick: ReturnType<typeof setInterval> | null = null;
  let resizeSession: {
    win: BrowserWindow;
    edge: WidgetResizeEdge;
    startBounds: Electron.Rectangle;
    startCursor: Electron.Point;
  } | null = null;
  const endWidgetResize = () => {
    if (resizeTick) {
      clearInterval(resizeTick);
      resizeTick = null;
    }
    if (resizeSession && !resizeSession.win.isDestroyed()) {
      settings().set({ lastWidgetBounds: resizeSession.win.getBounds() });
    }
    resizeSession = null;
  };
  ipcMain.on('widget:resizeStart', (e, edge: WidgetResizeEdge) => {
    const win = widgetOf(e);
    if (!win || win.isDestroyed()) return;
    const ok: WidgetResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    if (!ok.includes(edge)) return;
    endWidgetResize();
    resizeSession = {
      win,
      edge,
      startBounds: win.getBounds(),
      startCursor: screen.getCursorScreenPoint(),
    };
    resizeTick = setInterval(() => {
      if (!resizeSession || resizeSession.win.isDestroyed()) {
        endWidgetResize();
        return;
      }
      const cur = screen.getCursorScreenPoint();
      const next = applyWidgetResize(
        resizeSession.startBounds,
        resizeSession.edge,
        cur.x - resizeSession.startCursor.x,
        cur.y - resizeSession.startCursor.y,
      );
      resizeSession.win.setBounds(next, false);
    }, 16);
  });
  ipcMain.on('widget:resizeEnd', () => endWidgetResize());

  // --- app info + learning reads ---
  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    // Only sealed trial builds send setup progress, so only they show its setting.
    sendsSetupProgress: trialBuildEnabled() && !fullProductBuildEnabled(),
    user: greetingName(await firstName()),
    shortcut: settings().all().shortcut,
  }));
  ipcMain.handle('learning:profile', () => computeProfile(store().events(), todayKey()));
  ipcMain.handle('learning:feed', (_e, limit: number) => computeFeed(store().events(), limit ?? 8));
  ipcMain.handle('learning:history', (_e, limit: number) => computeLearningItems(store().events(), Math.max(1, Math.min(limit ?? 100, 250))));
  ipcMain.handle('learning:queue', (_e, limit: number) => computeReviewQueue(store().events(), new Date(), Math.max(1, Math.min(limit ?? 20, 50))));
  ipcMain.handle('learning:item', (_e, id: string) => {
    const event = store().eventById(id);
    if (!event) return null;
    return computeLearningItems([event], 1)[0] ?? null;
  });
  ipcMain.handle('learning:setNote', (_e, input: { id?: unknown; note?: unknown } | undefined) => {
    if (typeof input?.id !== 'string' || !input.id) return { ok: false, error: 'Missing lesson.' };
    if (typeof input?.note !== 'string') return { ok: false, error: 'Note must be text.' };
    try {
      const saved = store().updateLesson(input.id, { note: input.note });
      return saved ? { ok: true } : { ok: false, error: 'That lesson is no longer on this Mac.' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not save this note.' };
    }
  });
  ipcMain.handle('learning:forget', (_e, id: string) => {
    if (typeof id !== 'string' || !id) return { ok: false, error: 'Missing lesson.' };
    store().forgetEvent(id);
    return { ok: true };
  });
  ipcMain.handle('study:askStatus', () => studyAskStatus());
  ipcMain.handle('study:ask', (_e, input: { eventId: string; question: string; messages?: Array<{ role: 'user' | 'assistant'; content: string }> }) => askStudyAssistant(input));
  ipcMain.handle('quiz:status', () => quizCardStatus());
  ipcMain.handle('quiz:start', (_e, input: { eventId: string; mode?: 'quick-check' | 'recall' | 'scenario' }) =>
    startQuizCard(input.eventId, input.mode),
  );
  ipcMain.handle('quiz:answer', (_e, input: { eventId: string; choice: number }) => answerQuizCard(input.eventId, input.choice));
  // wipeGeneration: the conversation's stamp; askChat refuses a conversation from before a wipe.
  ipcMain.handle('chat:ask', (_e, input: { messages?: Array<{ role: 'user' | 'assistant'; content: string }>; question: string; wipeGeneration?: number }) =>
    askChat(input));
  // wipeGeneration lets the panel stamp a conversation, so a save from before a wipe is dropped.
  ipcMain.handle('chat:threads', () => ({ ok: true, threads: store().chatThreads(), wipeGeneration: store().wipeGeneration() }));
  ipcMain.handle('chat:saveThread', (_e, thread: ChatThread, wipeGeneration: number) => saveChatThread(thread, wipeGeneration));
  ipcMain.handle('chat:deleteThread', (_e, id: string) => {
    store().deleteChatThread(id);
    return { ok: true };
  });

  ipcMain.handle('project:pickRoot', async () => {
    const picked = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
    const root = await resolveRepoRoot(picked.filePaths[0]);
    if (!root) return { ok: false, error: 'That folder is not a git repository.' };
    return { ok: true, root };
  });

  ipcMain.handle('review:explainDiff', async (e, opts?: { brief?: boolean; level?: ExplanationLevel; scope?: BriefScope }) => {
    const brief = Boolean(opts?.brief);
    const feature = brief ? 'Change briefs' : 'Git diff explanations';
    // Plan check first, so a Free user is never asked to pick a folder for a feature they cannot use.
    // Only the panel renders the upgrade prompt; Briefs shows the returned error and gets no panel.
    const panel = currentWidget();
    const askedFromPanel = panel !== null && widgetOf(e) === panel;
    if (!(await requireProOrError(askedFromPanel ? panel : null, activeTabId, feature))) {
      return { ok: false, error: 'Pro required' };
    }
    let root = await resolveRepoRoot();
    if (!root) {
      const picked = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Choose a git project' });
      if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
      root = await resolveRepoRoot(picked.filePaths[0]);
    }
    if (!root) return { ok: false, error: 'Pick a git repository to explain changes.' };
    // Briefs asks from the companion window, which does not render reviews; the review always goes to the panel.
    const { win } = openPanel();
    showBar(bar);
    const session = sessionFor() ?? makeSession(activeTabId, null, null, opts?.level);
    tabSessions.set(activeTabId, session);
    if (opts?.level) session.level = opts.level;
    const scope = opts?.scope ?? 'working';
    return startBuiltReview(
      win,
      session,
      () => buildDiffPayload({ repoRoot: root!, level: session.level, mode: brief ? 'brief' : 'diff', scope }),
      brief ? 'Change brief' : 'Git diff',
    );
  });

  ipcMain.handle('brief:build', async (_e, input?: { scope?: BriefScope; pick?: boolean }) => {
    const scope = input?.scope ?? 'working';
    let root = await resolveRepoRoot();
    // Only ever open a folder dialog when the user asked for it. Background refreshes stay silent.
    if (input?.pick) {
      const picked = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Choose a git project' });
      if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
      root = await resolveRepoRoot(picked.filePaths[0]);
    }
    if (!root) return { ok: false, needsRepo: true, error: 'Choose a git project to build a change brief.' };
    try {
      pulseBar({ phase: 'searching', label: 'Searching' });
      const head = await gitHeadState(root);
      const hunks = capHunks(await collectDiffHunks(root, scope));
      pulseBar({ phase: 'analyzing', label: 'Analyzing' });
      const brief = buildChangeBrief({ repo: root, scope, hunks });
      productEvent('change_brief_opened', { files: brief.filesChanged });
      pulseBar({ phase: 'ready', label: 'Ready' });
      return { ok: true, brief, branch: head.branch, detached: head.detached };
    } catch (error) {
      pulseBar({ phase: 'error', label: 'Issue' });
      return { ok: false, error: error instanceof Error ? error.message : 'Could not read git changes.' };
    }
  });

  ipcMain.handle('origin:lookup', async () => {
    const session = sessionFor();
    const file = session?.payload?.context.primaryFile ?? session?.file;
    const root = await resolveRepoRoot(session?.sourceFilePath ? path.dirname(session.sourceFilePath) : undefined);
    if (!root || !file) {
      return { ok: false, error: 'Unvibe could not find documented history for this code.' };
    }
    pulseBar({ phase: 'searching', label: 'Searching' });
    const start = session?.payload?.context.selection?.startLine ?? 1;
    const end = session?.payload?.context.selection?.endLine ?? start;
    const blame = await blameRange(root, file, start, end);
    const history = await fileHistory(root, file, 8);
    const first = history.at(-1);
    const report = buildOriginReport({
      file,
      lineStart: start,
      lineEnd: end,
      blameAuthor: blame?.author,
      blameDate: blame?.date,
      firstCommit: first ? `${first.hash} · ${first.date}` : blame?.commit,
      firstSubject: first?.subject || blame?.summary,
      laterSubjects: history.slice(0, 4).map((row) => `${row.hash} ${row.subject}`),
    });
    productEvent('origin_opened');
    pulseBar({ phase: 'ready', label: 'Ready' });
    return { ok: true, report };
  });

  ipcMain.handle('knowledge:list', async () => {
    const root = settings().all().lastProjectRoot;
    const repo = root ? path.basename(root) : undefined;
    const items = knowledgeStore().list();
    return { ok: true, items, repo };
  });

  ipcMain.handle('knowledge:verify', (_e, input: { id?: string; status?: 'HUMAN_CONFIRMED' | 'HUMAN_CORRECTED' }) => {
    if (!input?.id || !input.status) return { ok: false, error: 'Missing knowledge id.' };
    const item = knowledgeStore().verify(input.id, input.status);
    return item ? { ok: true, item } : { ok: false, error: 'That knowledge object was not found.' };
  });

  ipcMain.handle('knowledge:refresh', async (_e, id: string) => {
    const item = knowledgeStore().list().find((row) => row.id === id);
    if (!item?.file) return { ok: false, error: 'That knowledge object has no file to refresh against.' };
    const root = settings().all().lastProjectRoot;
    if (!root) return { ok: false, error: 'Pick a git repository first.' };
    const code = await readRepoFile(root, item.file);
    if (code == null) return { ok: false, error: 'Unvibe could not read the current file.' };
    const next = knowledgeStore().refreshAgainst(id, code);
    productEvent('knowledge_refreshed');
    return next ? { ok: true, item: next } : { ok: false, error: 'Could not refresh that knowledge object.' };
  });

  ipcMain.handle('teachback:grade', (_e, input: { answer?: string }) => {
    const session = sessionFor();
    const explanation = session?.explanationText?.trim() ?? '';
    const answer = String(input?.answer ?? '');
    const result = gradeTeachBack(explanation, answer);
    if (result.evidence !== 'NOT_ENOUGH') {
      knowledgeStore().recordTeachBack({
        concept: session?.file ?? 'current explanation',
        file: session?.file,
        question: 'Explain this change in your own words.',
        answer,
        evidence: result.evidence,
        checks: result.checks,
        codeVersion: session?.reviewId ?? '',
      });
      productEvent('teachback_completed');
    }
    return { ok: true, result };
  });

  ipcMain.handle('live:snooze', (_e, hours: number) => {
    const ms = Math.min(24, Math.max(1, Number(hours) || 1)) * 60 * 60 * 1000;
    settings().set({ liveSnoozeUntil: new Date(Date.now() + ms).toISOString() });
    return { ok: true, until: settings().all().liveSnoozeUntil };
  });

  ipcMain.handle('review:explainCompare', async (e, opts?: { level?: ExplanationLevel }) => {
    const win = widgetOf(e) ?? getOrCreateWidget();
    showBar(bar);
    const session = sessionFor() ?? makeSession(activeTabId, null, null, opts?.level);
    tabSessions.set(activeTabId, session);
    if (opts?.level) session.level = opts.level;
    if (!(await requireProOrError(win, session.tabId, 'Since last understood'))) {
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

  ipcMain.handle('review:reopenItem', async (_e, item: { id?: string; file?: string; project?: string; level?: string }) => {
    const { win } = openPanel();
    showBar(bar);
    const level = (item.level as ExplanationLevel) || 'intermediate';
    const session = sessionFor() ?? makeSession(activeTabId, null, null, level);
    session.level = level;
    tabSessions.set(activeTabId, session);
    const saved = item.id ? store().eventById(item.id) : undefined;
    const savedCode = saved?.code?.trim();

    const openFromCode = async (code: string, filePath?: string, repoRoot?: string | null) => {
      if (code.length > MAX_PICK_BYTES) return { ok: false as const, error: 'That lesson is too large to reopen here.' };
      const usage = await cachedAppUsage();
      const built = await buildSelectionPayload({
        code,
        level: session.level,
        filePath,
        repoRoot: repoRoot ?? undefined,
        withNearby: isProPlan(usage.plan),
      });
      applyBuiltReview(session, built);
      session.sourceApp = 'Study';
      session.reviewId = randomUUID();
      // A panel that is still loading starts this tab itself on widget:ready.
      if (!panelReady) return { ok: true as const };
      initWidget(win, session, { autoStart: true });
      void runReview(win, session, { level: session.level });
      return { ok: true as const };
    };

    if (!item.file && savedCode) {
      return openFromCode(savedCode, saved?.file);
    }
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
      if (picked.canceled || !picked.filePaths[0]) {
        if (savedCode) return openFromCode(savedCode, item.file);
        return { ok: false, cancelled: true };
      }
      root = await resolveRepoRoot(picked.filePaths[0]);
      if (!root || (item.project && path.basename(root) !== item.project)) {
        if (savedCode) return openFromCode(savedCode, item.file);
        return { ok: false, error: `That folder does not look like the “${item.project}” project.` };
      }
    }
    const abs = root ? path.join(root, item.file) : item.file;
    try {
      const text = await readFile(abs, 'utf8');
      return openFromCode(text, abs, root);
    } catch {
      if (savedCode) return openFromCode(savedCode, item.file, root);
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
  ipcMain.handle('integrations:status', () => integrationStatus());
  ipcMain.handle('integrations:installBridge', (_e, editor: unknown) => {
    if (editor !== 'cursor' && editor !== 'vscode') return { ok: false, error: 'Choose Cursor or VS Code.' };
    return installDesktopBridge(editor);
  });
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
    if ((patch.barPosition || patch.barSize) && bar && !bar.isDestroyed()) {
      resizeBar(bar, false, true);
      bar.webContents.send('bar:collapse');
      positionBar(bar);
    } else if (patch.followActiveDisplay && bar && !bar.isDestroyed()) {
      positionBar(bar);
    }
    if ((patch.barPosition || patch.barSize || patch.barHoverPreview !== undefined || patch.barHoverDelayMs !== undefined || patch.soundEffects !== undefined || patch.soundVolume !== undefined || patch.soundStyle !== undefined) && bar && !bar.isDestroyed()) {
      bar.webContents.send('bar:settings', {
        barPosition: next.barPosition,
        barSize: next.barSize,
        barHoverPreview: next.barHoverPreview,
        barHoverDelayMs: next.barHoverDelayMs,
        soundEffects: next.soundEffects,
        soundVolume: next.soundVolume,
        soundStyle: next.soundStyle,
      });
    }
    if (patch.barVisibility && bar && !bar.isDestroyed()) {
      if (next.barVisibility === 'always' && next.onboarded) showBar(bar);
      else if (!currentWidget()) hideBar(bar);
    }
    if (patch.barHoverPreview === false) {
      resizeBar(bar, false);
      if (bar && !bar.isDestroyed()) bar.webContents.send('bar:collapse');
    }
    return { settings: settings().all() };
  });

  // --- external links ---
  ipcMain.handle('app:openPrivacy', () => {
    void shell.openExternal('https://unvibe.site/privacy');
    return { ok: true };
  });
  ipcMain.handle('app:openUrl', (_event, url: unknown) => {
    if (typeof url !== 'string' || !allowedExternalUrl(url)) return { ok: false };
    void shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle('feedback:send', (_event, input: FeedbackInput | undefined) => sendFeedback(input, { fetcher: networkFetch, appVersion: app.getVersion() }));
  ipcMain.handle('app:reportFeedback', (_event, context: { screen?: unknown; version?: unknown }) => {
    const screen = typeof context.screen === 'string' ? context.screen.slice(0, 120) : 'Unknown screen';
    const version = typeof context.version === 'string' ? context.version.slice(0, 48) : app.getVersion();
    const subject = encodeURIComponent('Unvibe beta feedback');
    const body = encodeURIComponent([
      'Hi Preston,',
      '',
      'What happened, and what were you trying to do?',
      '',
      'Context (added by Unvibe):',
      `• App version: ${version}`,
      `• Screen: ${screen}`,
      `• Platform: ${process.platform}`,
      '',
      'Optional: attach a screenshot if it makes the issue easier to see.',
    ].join('\n'));
    void shell.openExternal(`mailto:hello@unvibe.site?subject=${subject}&body=${body}`);
    return { ok: true };
  });

  // --- permissions ---
  ipcMain.handle('perms:accessibility', () => ({ granted: accessibilityGranted(false), platform: process.platform }));
  // macOS can keep a stale Accessibility entry that looks switched on but no longer matches this
  // copy of Unvibe (for example after an ad-hoc local build). Clear it and ask again.
  ipcMain.handle('perms:resetAccessibility', async () => {
    if (!isMac) return { ok: true };
    await new Promise<void>((resolve) => execFile('tccutil', ['reset', 'Accessibility', 'com.unvibe.app'], () => resolve()));
    accessibilityGranted(true);
    return { ok: true };
  });
  ipcMain.handle('app:restart', () => { quitting = true; app.relaunch(); app.exit(0); });
  ipcMain.handle('perms:promptAccessibility', () => ({ granted: accessibilityGranted(true) }));
  ipcMain.handle('perms:openAccessibility', () => {
    if (isMac)
      void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    return { ok: true };
  });
  /**
   * The panel saw the grant arrive: go back to the app the shortcut was pressed in and explain the
   * selection already made. `explained: false` when there is nothing to go back to or nothing was
   * selected any more; the panel then says in one line what to do.
   */
  ipcMain.handle('perms:explainAfterGrant', async () => {
    const fromApp = grantReturnApp(pendingGrant, Date.now());
    if (!fromApp) {
      pendingGrant = null;
      return { explained: false };
    }
    if (!accessibilityGranted(false)) return { explained: false };
    pendingGrant = null;
    const capture = await captureSelection({ fromApp });
    if (!capture.code) return { explained: false };
    await startReview({ captured: { code: capture.code, sourceApp: fromApp } });
    return { explained: true };
  });
  // Voice questions use macOS Dictation; this opens the Keyboard pane where it is switched on.
  ipcMain.handle('perms:openDictation', () => {
    if (isMac) void shell.openExternal('x-apple.systempreferences:com.apple.Keyboard-Settings.extension');
    return { ok: true };
  });

  // --- onboarding ---
  ipcMain.on('onboarding:explainSample', () => void startReview({ sample: true }));
  // Step 3's second option: works without Accessibility, on Mac and Windows.
  ipcMain.on('onboarding:explainClipboard', () => void startReview({ preferClipboard: true }));
  /** The one skippable level question after the sample (first-run spec, change 3). */
  ipcMain.handle('onboarding:levelAnswer', (_e, answer: unknown) => {
    if (!isLevelAnswer(answer)) return { ok: false as const };
    const level = levelAfterAnswer(settings().all().defaultExplanationLevel, answer);
    settings().set({ defaultExplanationLevel: level });
    reportProgress('level_answered');
    return { ok: true as const, level };
  });
  ipcMain.handle('onboarding:complete', () => {
    const next = settings().set({ onboarded: true });
    reportProgress('onboarded');
    if (next.barVisibility === 'always') showBar(bar);
    return next;
  });

  // --- account ---
  ipcMain.handle('account:get', () => store().account());
  // Plan card and panel copy: "Payments open soon" while checkout is closed. The server caches 5 minutes too.
  let billingStatusCache: { at: number; value: { paymentsOpen: boolean } } | null = null;
  ipcMain.handle('billing:status', async () => {
    if (billingStatusCache && Date.now() - billingStatusCache.at < 300_000) return billingStatusCache.value;
    const value = await billingStatus();
    billingStatusCache = { at: Date.now(), value };
    return value;
  });
  ipcMain.handle('billing:overview', async () => {
    const token = store().token();
    if (!token) return { ok: false, error: 'Sign in to view your plan and cloud usage.' };
    try { return { ok: true, data: await billingOverview(token) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Could not load plan.' }; }
  });
  ipcMain.handle('usage:get', async () => {
    try { return { ok: true, data: { ...await refreshAppUsage(), selections: store().betaSelectedCodeUsage() } }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Could not load usage.' }; }
  });
  ipcMain.handle('update:check', async () => {
    try { return { ok: true, ...(await checkForUpdate(true)) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Could not check for updates.' }; }
  });
  ipcMain.handle('update:install', async () => {
    try {
      return await installUpdate((pct) => companion?.webContents.send('update:progress', pct));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'The update could not be installed.' };
    }
  });
  // Look for a newer release shortly after launch and every hour. The Home page shows it, and a
  // desktop notification announces each new version once (clicking it installs the update).
  const notifiedFile = path.join(app.getPath('userData'), 'update-notified.txt');
  const alreadyNotified = (version: string) => {
    try { return readFileSync(notifiedFile, 'utf8').trim() === version; } catch { return false; }
  };
  const announceUpdate = () => void checkForUpdate().then((info) => {
    if (!info.available || !info.latest) return;
    companion?.webContents.send('update:available', info);
    if (alreadyNotified(info.latest) || !Notification.isSupported()) return;
    try { writeFileSync(notifiedFile, info.latest); } catch { /* still notify this session */ }
    const note = new Notification({
      title: `Unvibe ${info.latest} is ready`,
      body: 'Click to update now. It takes about a minute and reopens by itself.',
      silent: false,
    });
    note.on('click', () => {
      openCompanion();
      void installUpdate((pct) => companion?.webContents.send('update:progress', pct)).catch(() => undefined);
    });
    note.show();
  }).catch(() => undefined);
  setTimeout(announceUpdate, 8000);
  setInterval(announceUpdate, 60 * 60_000);

  // The server issues the code (an HMAC only it can compute) and counts friends who used it.
  ipcMain.handle('gift:status', async () => {
    const email = store().account()?.email ?? null;
    const token = store().token();
    if (!email || !token) {
      return { ok: true, needsSignIn: true, code: '', shareUrl: '', used: 0, limit: GIFT_LIMIT, email: null };
    }
    try {
      const progress = await giftProgress(token);
      return { ok: true, needsSignIn: false, code: progress.code, shareUrl: progress.shareUrl, used: capGiftUsed(progress.used), limit: GIFT_LIMIT, email };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Your invite link could not load.';
      return { ok: false, needsSignIn: false, code: '', shareUrl: '', used: 0, limit: GIFT_LIMIT, email, error };
    }
  });
  ipcMain.handle('gift:claim', async (_e, input: string) => {
    const token = store().token();
    if (!token) return { ok: false, error: 'Sign in before using a gift code.' };
    const code = giftCodeFromInput(String(input ?? ''));
    if (!code) return { ok: false, error: 'Paste the code or the whole link your friend shared.' };
    try {
      const result = await claimGiftCode(token, code);
      return { ok: true, monthAdded: result.monthAdded };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'The gift could not be used.' };
    }
  });
  ipcMain.handle('ai:keyStatus', () => ({ ok: true, data: aiKeyStatus() }));
  ipcMain.handle('ai:setKey', (_e, key: string) => {
    try {
      const trimmed = String(key ?? '');
      writeAiKey(trimmed);
      const guessed = guessProviderFromKey(trimmed);
      if (guessed) settings().set({ aiProvider: guessed });
      return { ok: true, data: aiKeyStatus(), provider: settings().all().aiProvider };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not save the API key.' };
    }
  });
  ipcMain.handle('ai:clearKey', () => { clearAiKey(); return { ok: true, data: aiKeyStatus() }; });
  ipcMain.handle('ai:models', () => ({ ok: true, data: listLocalAiProviders() }));
  ipcMain.handle('ai:costOverview', (_e, provider?: LocalAiProviderId) => {
    const id = normalizeLocalAiProvider(provider ?? settings().all().aiProvider);
    return { ok: true, data: costOverview(id) };
  });
  ipcMain.handle('billing:checkout', async (_e, input: { plan: 'pro' | 'teams'; interval: 'monthly' | 'annual'; seats: number; workspaceId?: string; workspaceName?: string }) => {
    const token = store().token();
    if (!token) return { ok: false, error: 'Sign in before starting checkout.' };
    try {
      const url = await startBillingCheckout(token, input);
      if (!isBillingUrl(url)) return { ok: false, error: 'Checkout returned a link Unvibe does not open. Try again from unvibe.site.' };
      await shell.openExternal(url);
      return { ok: true };
    }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Checkout could not start.' }; }
  });
  ipcMain.handle('billing:portal', async (_e, workspaceId: string) => {
    const token = store().token();
    if (!token) return { ok: false, error: 'Sign in before managing billing.' };
    try {
      const url = await startBillingPortal(token, workspaceId);
      if (!isBillingUrl(url)) return { ok: false, error: 'Billing returned a link Unvibe does not open. Try again from unvibe.site.' };
      await shell.openExternal(url);
      return { ok: true };
    }
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
      // Use user_code — never ?code= (that collides with Google/Supabase OAuth).
      const verificationUrl = deviceVerificationUrl(device.verificationUri, device.userCode);
      currentDeviceVerificationUrl = verificationUrl;
      let browserOpened = true;
      try {
        await shell.openExternal(verificationUrl);
        console.info('[auth] opened device verification browser');
      } catch {
        browserOpened = false;
        console.warn('[auth] could not open device verification browser');
      }
      if (devicePoll) clearInterval(devicePoll);
      const expires = Date.now() + 10 * 60_000;
      devicePoll = setInterval(() => void (async () => {
        if (Date.now() > expires) {
          if (devicePoll) clearInterval(devicePoll);
          devicePoll = null;
          currentDeviceVerificationUrl = null;
          companion?.webContents.send('account:device', { ok: false, error: 'Sign-in timed out. Use Retry to create a new secure link.' });
          return;
        }
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
          currentDeviceVerificationUrl = null;
          void flush();
          companion?.webContents.send('account:device', { ok: true, email: account.email ?? 'Signed-in user', name: account.name });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'The secure sign-in request ended.';
          if (/expired|unknown|already redeemed/i.test(message)) {
            if (devicePoll) clearInterval(devicePoll);
            devicePoll = null;
            currentDeviceVerificationUrl = null;
            companion?.webContents.send('account:device', { ok: false, error: 'This sign-in link is no longer valid. Use Retry to create a new one.' });
          }
        }
      })(), Math.max(2, device.interval) * 1000);
      return { ok: true, userCode: device.userCode, verificationUri: verificationUrl, browserOpened };
    } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Could not start secure sign-in.' }; }
  });
  ipcMain.handle('account:openDeviceAuth', async () => {
    if (!currentDeviceVerificationUrl) return { ok: false, error: 'Start sign-in again to create a fresh link.' };
    try {
      await shell.openExternal(currentDeviceVerificationUrl);
      console.info('[auth] reopened device verification browser');
      return { ok: true };
    } catch {
      console.warn('[auth] could not reopen device verification browser');
      return { ok: false, error: 'Could not open your browser. Copy the link and open it yourself.' };
    }
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
      invalidateAppUsage();
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Local sign-out could not be saved.', warning };
    }
    return { ok: true, warning };
  });
  ipcMain.handle('account:delete', async () => {
    const result = await deleteAccountAndLocalData(() => {
      const panel = currentWidget();
      if (panel && !panel.isDestroyed()) panel.close();
      clearPanelSessions();
    });
    if (result.ok) invalidateAppUsage();
    return result;
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
