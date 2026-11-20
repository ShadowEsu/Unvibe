import { app, globalShortcut, ipcMain, screen, type BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import {
  bubbleCopy,
  EDITOR_NAMES,
  ghostPlacement,
  ghostWindowBounds,
  GHOST_IDLE_MS,
  parseHelperLine,
  previewBullets,
  previewTitle,
  reduceGhost,
  type BubbleItem,
  type BubblePlatform,
  type GhostInput,
  type GhostState,
  type Point,
} from '../core/bubble';
import { isProPlan } from '../core/plan';
import { scanReviewPayload } from '../core/secretFilter';
import { explanationFailure, serviceMessage } from '../core/serviceError';
import { SseParser } from '../core/sse';
import type { ExplanationLevel } from '../core/protocol';
import { readAiKey } from './aiKey';
import { postPreview } from './backend';
import { bubbleStore } from './bubbleStore';
import { providerInUse } from './consent';
import { codeConsented, sendingSwitchedOff } from './consentStore';
import { buildSelectionPayload, sendNearbyFiles } from './contextBuilder';
import { buildLocalPreviewSystemPrompt, buildLocalPreviewUserPrompt, streamLocalAi } from './localAi';
import { captureSelection, frontmostApp } from './selection';
import { settings } from './settings';
import { store } from './store';
import { cachedAppUsage } from './usage';
import { createGhostWindow } from './windows';

/** What the ghost's renderer draws. Only what main decided; nothing from another app's window reaches it. */
export interface GhostView {
  look: 'hidden' | 'ghost' | 'pill' | 'preview';
  flipped: boolean;
  shortcut: string;
  preview?: {
    phase: 'reading' | 'streaming' | 'done' | 'error';
    title: string;
    bullets: string[];
    message?: string;
  };
}

const FIRST_TOKEN_MS = 30_000;
const STREAM_IDLE_MS = 30_000;
const RESTART_WINDOW_MS = 10 * 60_000;
const MAX_RESTARTS = 5;
const NOT_READ = "Couldn't read your selection. Select the code again, then press the button or the shortcut.";

/**
 * Which system's editor list and coordinates apply. The real platform, except in an unpackaged dev build, where
 * `UNVIBE_DEV_BUBBLE_PLATFORM` lets the laptop harness walk the Mac or Windows behaviour with a scripted helper.
 */
function bubblePlatform(): BubblePlatform | null {
  const dev = !app.isPackaged ? process.env.UNVIBE_DEV_BUBBLE_PLATFORM : undefined;
  const p = dev === 'darwin' || dev === 'win32' ? dev : process.platform;
  return p === 'darwin' || p === 'win32' ? p : null;
}

/**
 * The helper ships inside the app (Security H1): Contents/Resources/selection-watch on a Mac, resources\selection-watch
 * on Windows, launched by that absolute path with no arguments. An unpackaged build uses native/dist, or the dev-only
 * scripted helper the laptop harness names.
 */
export function helperPath(): string | null {
  const devScript = !app.isPackaged ? process.env.UNVIBE_DEV_SELECTION_HELPER : undefined;
  if (devScript) return path.isAbsolute(devScript) && existsSync(devScript) ? devScript : null;
  const name = process.platform === 'win32' ? 'unvibe-selection-watch.exe' : 'unvibe-selection-watch';
  const dir = app.isPackaged ? path.join(process.resourcesPath, 'selection-watch') : path.join(app.getAppPath(), 'native', 'dist');
  const file = path.join(dir, name);
  return existsSync(file) ? file : null;
}

export interface BubbleDeps {
  /** Exactly what Control+U does (Security G7). */
  explain: () => void;
  /** The full explanation of a selection Quick look already read: counts as one explanation. */
  explainCaptured: (code: string, sourceApp: string) => void;
}

let deps: BubbleDeps | null = null;
let helper: ChildProcess | null = null;
let restarts: number[] = [];
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let ghostWin: BrowserWindow | null = null;
let ghostReady = false;
let state: GhostState = { look: 'hidden' };
let anchor: { x: number; y: number; flipped: boolean } | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let previewHeight = 120;
let preview: { run: number; abort: AbortController; code: string | null; sourceApp: string; view: NonNullable<GhostView['preview']> } | null = null;
let previewRuns = 0;
let escapeHeld = false;

function active(): boolean {
  return bubblePlatform() !== null && bubbleStore().state().ghost && !sendingSwitchedOff();
}

/** Starts or stops the helper to match the switch, the agreement's off switch and the platform. Call after any of them changes. */
export function refreshBubble(): void {
  if (active()) startHelper();
  else stopBubble();
}

export function stopBubble(): void {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
  const running = helper;
  helper = null;
  running?.kill();
  apply({ look: 'hidden' });
}

function startHelper(): void {
  if (helper || restartTimer) return;
  const file = helperPath();
  if (!file) return;
  // No arguments, no shell, and stderr is never read or kept (Security H1, H2).
  const child = spawn(file, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, shell: false });
  helper = child;
  createInterface({ input: child.stdout! }).on('line', (line) => {
    const event = parseHelperLine(line);
    if (event) onInput(event);
  });
  child.on('error', () => undefined);
  child.on('exit', () => {
    if (helper !== child) return;
    helper = null;
    apply({ look: 'hidden' });
    const now = Date.now();
    restarts = [...restarts.filter((at) => now - at < RESTART_WINDOW_MS), now];
    // A helper that keeps dying is left stopped; Control+U still works.
    if (restarts.length > MAX_RESTARTS || !active()) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      refreshBubble();
    }, 2_000);
  });
}

/** Windows hooks report physical pixels; Electron places windows in DIPs. */
function toDip(p: Point): Point {
  return process.platform === 'win32' && bubblePlatform() === 'win32' ? screen.screenToDipPoint(p) : p;
}

function insideBubble(p: Point): boolean {
  if (!ghostWin || ghostWin.isDestroyed() || !ghostWin.isVisible()) return false;
  const b = ghostWin.getBounds();
  return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
}

function onInput(input: GhostInput): void {
  const platform = bubblePlatform();
  if (!platform) return;
  const event = 'x' in input && 'y' in input ? { ...input, ...toDip(input) } : input;
  const before = state;
  const next = reduceGhost(state, event, { platform, previewOn: bubbleStore().state().preview, inside: insideBubble });
  if (next.effect === 'none' && next.state === before) return;
  // Leaving the card for any reason drops its request and its result (Security A4).
  if (before.look === 'preview' && next.state.look !== 'preview') endPreview();
  if (next.effect === 'explain') {
    apply(next.state);
    deps?.explain();
    return;
  }
  if (event.e === 'select' && next.state.look === 'ghost') anchor = null;
  apply(next.state);
  if (next.effect === 'preview') void runPreview(++previewRuns);
}

function shortcut(): string {
  return settings().all().shortcut;
}

function view(): GhostView {
  return {
    look: state.look,
    flipped: anchor?.flipped ?? false,
    shortcut: shortcut(),
    ...(state.look === 'preview' && preview ? { preview: preview.view } : {}),
  };
}

function ensureWindow(): BrowserWindow {
  if (ghostWin && !ghostWin.isDestroyed()) return ghostWin;
  ghostReady = false;
  const win = createGhostWindow();
  win.webContents.on('did-finish-load', () => {
    ghostReady = true;
    if (!win.isDestroyed()) win.webContents.send('ghost:view', view());
  });
  win.on('closed', () => {
    if (ghostWin === win) ghostWin = null;
  });
  ghostWin = win;
  return win;
}

function scheduleIdle(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (state.look === 'ghost') idleTimer = setTimeout(() => onInput({ e: 'idle' }), GHOST_IDLE_MS);
}

function apply(next: GhostState): void {
  state = next;
  scheduleIdle();
  if (next.look === 'hidden') {
    anchor = null;
    if (ghostWin && !ghostWin.isDestroyed()) {
      ghostWin.hide();
      if (ghostReady) ghostWin.webContents.send('ghost:view', view());
    }
    return;
  }
  const work = screen.getDisplayNearestPoint(next.at).workArea;
  anchor ??= ghostPlacement(next.at, work);
  const win = ensureWindow();
  win.setBounds(ghostWindowBounds(anchor, next.look, work, previewHeight));
  if (ghostReady) win.webContents.send('ghost:view', view());
  if (!win.isVisible()) win.showInactive();
  win.moveTop();
}

function sendPreview(patch: Partial<NonNullable<GhostView['preview']>>): void {
  if (!preview) return;
  preview.view = { ...preview.view, ...patch };
  if (state.look === 'preview' && ghostWin && !ghostWin.isDestroyed() && ghostReady) ghostWin.webContents.send('ghost:view', view());
}

/** Esc closes the card while it shows (A4), held only then: the ghost itself never listens to keys (G3). */
function holdEscape(on: boolean): void {
  if (on && !escapeHeld) {
    try {
      escapeHeld = globalShortcut.register('Escape', () => onInput({ e: 'close' }));
    } catch {
      escapeHeld = false;
    }
  } else if (!on && escapeHeld) {
    globalShortcut.unregister('Escape');
    escapeHeld = false;
  }
}

function endPreview(): void {
  holdEscape(false);
  preview?.abort.abort();
  preview = null;
  previewHeight = 120;
}

/**
 * Quick look (D5 T3): read the selection the way Control+U does, run the same secret scan, then stream 3 bullets
 * from the preview route (or the person's own key). Nothing is saved to the Library (A8). A selection with any
 * secret-scan finding goes to the full panel instead, which shows the scan's own question.
 */
async function runPreview(run: number): Promise<void> {
  const abort = new AbortController();
  preview = { run, abort, code: null, sourceApp: '', view: { phase: 'reading', title: '', bullets: [] } };
  holdEscape(true);
  sendPreview({});
  const current = () => preview?.run === run && !abort.signal.aborted;
  const usage = await cachedAppUsage();
  const provider = providerInUse(usage.remaining);
  if (!current()) return;
  if (!codeConsented(provider)) {
    // The panel asks for the agreement first; nothing is read before it (Security CC-4).
    onInput({ e: 'close' });
    deps?.explain();
    return;
  }
  const capture = await captureSelection({});
  if (!current()) return;
  if (!capture.code) {
    sendPreview({ phase: 'error', message: NOT_READ });
    return;
  }
  const code = capture.code;
  const sourceApp = capture.sourceApp ?? (await frontmostApp()) ?? '';
  if (!current()) return;
  preview!.code = code;
  preview!.sourceApp = sourceApp;
  sendPreview({ title: previewTitle(code) });
  const chosen: ExplanationLevel = settings().all().defaultExplanationLevel;
  const level: ExplanationLevel = chosen === 'expert' && !isProPlan(usage.plan) ? 'advanced' : chosen;
  const built = await buildSelectionPayload({ code, level, withNearby: sendNearbyFiles(usage.plan) });
  if (!current()) return;
  if (scanReviewPayload(built.payload).length > 0) {
    onInput({ e: 'close' });
    deps?.explainCaptured(code, sourceApp);
    return;
  }
  let text = '';
  let timedOut = false;
  let watchdog = setTimeout(() => { timedOut = true; abort.abort(); }, FIRST_TOKEN_MS);
  const take = (chunk: string) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { timedOut = true; abort.abort(); }, STREAM_IDLE_MS);
    text += chunk;
    if (current()) sendPreview({ phase: 'streaming', bullets: previewBullets(text) });
  };
  try {
    const prefs = settings().all();
    const key = readAiKey();
    if (provider !== 'unvibe' && key) {
      // A9: the person's own key, at their cost; the setting says so before it's ticked.
      await streamLocalAi({
        provider: prefs.aiProvider,
        apiKey: key,
        system: buildLocalPreviewSystemPrompt(built.payload),
        user: buildLocalPreviewUserPrompt(built.payload),
        onToken: take,
        signal: abort.signal,
      });
      if (current()) sendPreview({ phase: 'done', bullets: previewBullets(text) });
      return;
    }
    const res = await postPreview(built.payload, store().token(), abort.signal);
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: unknown; message?: unknown };
      const message = res.status === 401 ? explanationFailure(401, body).message : serviceMessage(body) || 'Quick look could not finish just now. Open the full explanation instead.';
      if (current()) sendPreview({ phase: 'error', message });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    let completed = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const ev of parser.feed(decoder.decode(value, { stream: true }))) {
        // Only token, done and error are read, each from its checked field (as for an explanation).
        if (ev.type === 'token' && typeof ev.text === 'string') take(ev.text);
        else if (ev.type === 'error') {
          if (current()) sendPreview({ phase: 'error', message: serviceMessage(ev) || 'Quick look could not finish just now. Open the full explanation instead.' });
          return;
        } else if (ev.type === 'done') completed = true;
      }
    }
    if (current()) {
      sendPreview(completed
        ? { phase: 'done', bullets: previewBullets(text) }
        : { phase: 'error', message: 'Quick look stopped before it finished. Open the full explanation instead.' });
    }
  } catch {
    if (preview?.run !== run) return;
    if (!abort.signal.aborted || timedOut) {
      sendPreview({ phase: 'error', message: timedOut ? 'Quick look took too long. Open the full explanation instead.' : 'Unvibe could not reach Quick look. Check your connection, or open the full explanation.' });
    }
  } finally {
    clearTimeout(watchdog);
  }
}

function openFull(): void {
  const held = preview;
  onInput({ e: 'close' });
  if (held?.code) deps?.explainCaptured(held.code, held.sourceApp);
  else deps?.explain();
}

export interface BubbleSettings {
  /** The helper exists for this system (Mac and Windows builds); Linux has no button. */
  available: boolean;
  ghost: boolean;
  preview: boolean;
  editors: string;
  copy: ReturnType<typeof bubbleCopy>;
}

export function bubbleSettings(): BubbleSettings {
  const platform = bubblePlatform();
  const pretty = platform === 'win32' ? 'Ctrl+Alt+U' : 'Control+U';
  return {
    available: platform !== null && helperPath() !== null,
    ...bubbleStore().state(),
    editors: platform ? EDITOR_NAMES[platform] : '',
    copy: bubbleCopy(pretty),
  };
}

export function registerBubble(d: BubbleDeps): void {
  deps = d;
  const fromGhost = (e: Electron.IpcMainEvent) => Boolean(ghostWin && !ghostWin.isDestroyed() && e.sender === ghostWin.webContents);
  ipcMain.on('ghost:hover', (e, on: unknown) => {
    if (fromGhost(e) && typeof on === 'boolean') onInput({ e: 'hover', on });
  });
  ipcMain.on('ghost:press', (e) => {
    if (fromGhost(e)) onInput({ e: 'press' });
  });
  ipcMain.on('ghost:close', (e) => {
    if (fromGhost(e)) onInput({ e: 'close' });
  });
  ipcMain.on('ghost:openFull', (e) => {
    if (fromGhost(e) && state.look === 'preview') openFull();
  });
  ipcMain.on('ghost:height', (e, height: unknown) => {
    if (!fromGhost(e) || typeof height !== 'number' || !Number.isFinite(height) || state.look !== 'preview') return;
    previewHeight = Math.round(height);
    apply(state);
  });
  ipcMain.handle('bubble:get', () => bubbleSettings());
  ipcMain.handle('bubble:set', (_e, item: unknown, on: unknown) => {
    if ((item !== 'ghost' && item !== 'preview') || typeof on !== 'boolean') return bubbleSettings();
    bubbleStore().set(item as BubbleItem, on);
    refreshBubble();
    return bubbleSettings();
  });
  app.on('will-quit', () => stopBubble());
  refreshBubble();
}
