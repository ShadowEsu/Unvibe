/**
 * The Unvibe button (D5 A), its Quick look (D5 T3) and auto mode (ledger 646): the pure parts.
 *
 * A small native helper watches the mouse (never the keyboard, Security G3) and reports one JSON line per
 * gesture. Main decides from those lines alone whether the ghost shows: only in an allowed code editor, only
 * after a mouse selection, never in a denied app. In editors nothing is read before a press (Security G2 as
 * clarified 7 Nov); a press runs exactly the Control+U path (G7), or with Quick look on, a 3-bullet preview.
 * Auto mode, its own opt-in, does what a press does once the selection has stayed put, behind AutoExplainGate.
 */

export type BubblePlatform = 'darwin' | 'win32';

/**
 * Code editors, the only default (Security G4; the 11 Nov brief: "editors only"). Mac entries are bundle ids,
 * Windows entries lower-case exe names. JetBrains IDEs are left out on a Mac: they paste twice when a
 * selection tool copies after a mouse-up (FEASIBILITY [M25]), so Control+U stays the way there.
 */
const MAC_EDITORS: ReadonlySet<string> = new Set([
  'com.microsoft.VSCode',
  'com.microsoft.VSCodeInsiders',
  'com.todesktop.230313mzl4w4u92', // Cursor
  'com.apple.dt.Xcode',
  'dev.zed.Zed',
  'dev.zed.Zed-Preview',
  'com.sublimetext.4',
  'com.sublimetext.3',
]);

const WIN_EDITORS: ReadonlySet<string> = new Set([
  'code.exe',
  'code - insiders.exe',
  'cursor.exe',
  'zed.exe',
  'sublime_text.exe',
  'idea64.exe',
  'pycharm64.exe',
  'webstorm64.exe',
  'goland64.exe',
  'rider64.exe',
  'clion64.exe',
  'phpstorm64.exe',
  'rubymine64.exe',
  'datagrip64.exe',
]);

/** Unvibe's own app as the helper names it: the bundle id or exe name (Electron's in a dev build). */
export function isUnvibe(platform: BubblePlatform, app: string): boolean {
  return platform === 'darwin'
    ? app === 'com.unvibe.app' || app === 'com.github.Electron'
    : ['unvibe.exe', 'electron.exe'].includes(app.toLowerCase());
}

/** Never, even if someone adds them later: password managers and Unvibe itself (G4). */
const DENIED = /1password|bitwarden|keychain ?access|com\.apple\.keychainaccess|com\.apple\.passwords|^passwords(\.exe)?$|keepassxc|dashlane|lastpass|unvibe/i;

/** Human names for the editors, for Settings ("Works in …"). */
export const EDITOR_NAMES: Readonly<Record<BubblePlatform, string>> = {
  darwin: 'VS Code, Cursor, Xcode, Zed and Sublime Text',
  win32: 'VS Code, Cursor, JetBrains IDEs, Zed and Sublime Text',
};

export function ghostAllowedIn(platform: BubblePlatform, app: string): boolean {
  if (!app || DENIED.test(app)) return false;
  return platform === 'darwin' ? MAC_EDITORS.has(app) : WIN_EDITORS.has(app.toLowerCase());
}

/** What the helper says, one JSON object per line on its stdout (Security H1: stdout to main only). */
export type HelperEvent =
  | { e: 'ready'; v: number }
  /**
   * A mouse selection ended: a drag that started over text, or a double or triple click over text. `x`/`y` is the
   * selection's end (the drag's start for an upward or leftward drag); `px`/`py`, where the pointer rests.
   */
  | { e: 'select'; x: number; y: number; px?: number; py?: number; app: string; g: 'drag' | 'double' | 'triple' }
  /** A press, a right click or a scroll anywhere; the point lets main ignore ones on its own windows. */
  | { e: 'down' | 'right' | 'scroll'; x: number; y: number }
  /** Another app came to the front. */
  | { e: 'app'; app: string };

const GESTURES = new Set(['drag', 'double', 'triple']);
const COORD_LIMIT = 1_000_000;

function coord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= COORD_LIMIT;
}

function appId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 260 && !/[\u0000-\u001f]/.test(value);
}

/**
 * One helper line, checked field by field; anything else is dropped. The helper never sends text from the
 * selection, and a line that tried to would not parse: no event has a field for it. The helpers' `press` line (what
 * the I-beam read saw, for QA's logs) is dropped here too.
 */
export function parseHelperLine(line: string): HelperEvent | null {
  if (line.length > 1024) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  switch (o.e) {
    case 'ready':
      return typeof o.v === 'number' && Number.isInteger(o.v) ? { e: 'ready', v: o.v } : null;
    case 'select': {
      if (!(coord(o.x) && coord(o.y) && appId(o.app) && typeof o.g === 'string' && GESTURES.has(o.g))) return null;
      const event: HelperEvent = { e: 'select', x: o.x, y: o.y, app: o.app, g: o.g as 'drag' | 'double' | 'triple' };
      return coord(o.px) && coord(o.py) ? { ...event, px: o.px, py: o.py } : event;
    }
    case 'down':
    case 'right':
    case 'scroll':
      return coord(o.x) && coord(o.y) ? { e: o.e, x: o.x, y: o.y } : null;
    case 'app':
      return appId(o.app) ? { e: 'app', app: o.app } : null;
    default:
      return null;
  }
}

export interface Rect { x: number; y: number; width: number; height: number }
export interface Point { x: number; y: number }

/** Design NOTE §1: a 32 pt circle, 8 pt right of where the selection ended, centred on that line. */
export const GHOST_SIZE = 32;
export const GHOST_GAP = 8;
/**
 * The hover pill (Vibe · "Explain" · the shortcut's caps) sized to its content, Design S-1 SHOULD 2: 130 measured
 * with ⌃ U. The renderer reports the real width (other shortcuts have wider caps); this is the start value.
 */
export const PILL_WIDTH = 130;
/** The Quick look card (Design NOTE §3: about 320 pt). */
export const PREVIEW_WIDTH = 320;

function within(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Where the ghost goes for a selection's end point. Editors report no selection bounds we may read, so the point is
 * Design's fallback (Q1). It sits to the right, or flips left near the work area's right edge, and it never leaves
 * the work area (below the menu bar). `flipped` tells the pill and the card which way to grow. The resting pointer is
 * never over it (G7; lead N2): a short leftward drag near the right edge ends inside the flipped spot, so the ghost
 * moves to the other side if the pill fits there, else just under (or over) the pointer.
 */
export function ghostPlacement(at: Point, workArea: Rect, pillWidth = PILL_WIDTH, pointer?: Point): { x: number; y: number; flipped: boolean } {
  const fitsRight = at.x + GHOST_GAP + pillWidth <= workArea.x + workArea.width;
  const clampX = (x: number) => Math.round(within(x, workArea.x, workArea.x + workArea.width - GHOST_SIZE));
  const clampY = (y: number) => Math.round(within(y, workArea.y, workArea.y + workArea.height - GHOST_SIZE));
  const spot = (flipped: boolean, y = at.y - GHOST_SIZE / 2) => ({ x: clampX(flipped ? at.x - GHOST_GAP - GHOST_SIZE : at.x + GHOST_GAP), y: clampY(y), flipped });
  const covers = (s: { x: number; y: number }) => pointer !== undefined
    && pointer.x >= s.x - POINTER_MARGIN && pointer.x < s.x + GHOST_SIZE + POINTER_MARGIN
    && pointer.y >= s.y - POINTER_MARGIN && pointer.y < s.y + GHOST_SIZE + POINTER_MARGIN;
  const first = spot(!fitsRight);
  if (!covers(first) || !pointer) return first;
  // The other side: toward the left always (the pill grows left there); toward the right only when the pill fits.
  const other = spot(fitsRight);
  if (fitsRight && !covers(other)) return other;
  const below = spot(first.flipped, pointer.y + POINTER_MARGIN + GHOST_GAP);
  return covers(below) ? spot(first.flipped, pointer.y - POINTER_MARGIN - GHOST_GAP - GHOST_SIZE) : below;
}

/** How far the resting pointer must stay from the ghost's edge. */
const POINTER_MARGIN = 4;

/** The window for each look: the circle, the pill (grown away from the edge) or the Quick look card. */
export function ghostWindowBounds(
  anchor: { x: number; y: number; flipped: boolean },
  look: 'ghost' | 'pill' | 'preview',
  workArea: Rect,
  previewHeight = 120,
  pillWidth = PILL_WIDTH,
): Rect {
  if (look === 'ghost') return { x: anchor.x, y: anchor.y, width: GHOST_SIZE, height: GHOST_SIZE };
  if (look === 'pill') {
    const x = anchor.flipped ? anchor.x + GHOST_SIZE - pillWidth : anchor.x;
    return { x, y: anchor.y, width: pillWidth, height: GHOST_SIZE };
  }
  const height = Math.round(within(previewHeight, 80, Math.min(420, workArea.height)));
  const x = anchor.flipped ? anchor.x + GHOST_SIZE - PREVIEW_WIDTH : anchor.x;
  // Under the ghost; above it when the work area ends first.
  const below = anchor.y;
  const y = below + height > workArea.y + workArea.height ? anchor.y + GHOST_SIZE - height : below;
  return {
    x: Math.round(within(x, workArea.x, workArea.x + workArea.width - PREVIEW_WIDTH)),
    y: Math.round(within(y, workArea.y, workArea.y + workArea.height - height)),
    width: PREVIEW_WIDTH,
    height,
  };
}

/** How long an untouched ghost stays (Design NOTE §1). */
export const GHOST_IDLE_MS = 4_000;

export type GhostState =
  | { look: 'hidden' }
  | { look: 'ghost' | 'pill'; at: Point; app: string; hovered: boolean }
  | { look: 'preview'; at: Point; app: string };

export type GhostInput =
  | HelperEvent
  /** The ghost's own window: hover in and out, and a click on it. */
  | { e: 'hover'; on: boolean }
  | { e: 'press' }
  /** 4 s passed with the ghost untouched. */
  | { e: 'idle' }
  /** The Quick look card closed (Not now, Esc, Open full explanation). */
  | { e: 'close' };

export type GhostEffect = 'none' | 'show' | 'hide' | 'explain' | 'preview';

/**
 * The ghost's whole life. `inside` says whether a point is on one of Unvibe's own bubble windows, so a click
 * on the ghost or the card never counts as "clicked elsewhere" (the Windows hook sees those too).
 * A press with Quick look on opens the card; without it, it explains, the same as Control+U.
 */
export function reduceGhost(
  state: GhostState,
  input: GhostInput,
  ctx: { platform: BubblePlatform; previewOn: boolean; inside: (p: Point) => boolean },
): { state: GhostState; effect: GhostEffect } {
  const hidden = { state: { look: 'hidden' } as GhostState, effect: 'hide' as GhostEffect };
  const same = { state, effect: 'none' as GhostEffect };
  switch (input.e) {
    case 'select':
      // A drag or double-click on the button or card itself (the editor stays frontmost under a non-activating window)
      // is not a new selection: it keeps the card and its result (lead S2).
      if (state.look !== 'hidden' && ctx.inside(input)) return same;
      if (!ghostAllowedIn(ctx.platform, input.app)) return state.look === 'hidden' ? same : hidden;
      // A new selection while the card is open leaves the card (its request is for the old one): A4.
      return { state: { look: 'ghost', at: { x: input.x, y: input.y }, app: input.app, hovered: false }, effect: 'show' };
    case 'down':
    case 'right':
    case 'scroll':
      if (state.look === 'hidden' || ctx.inside(input)) return same;
      return hidden;
    case 'app':
      // Unvibe itself coming to the front is the press on the button or the card: macOS activates the app for a click
      // on its panel when the click is synthesized (electron#53889), and hiding there dropped the press (run 44677798585).
      if (state.look === 'hidden' || isUnvibe(ctx.platform, input.app)) return same;
      return input.app === state.app ? same : hidden;
    case 'hover':
      if (state.look !== 'ghost' && state.look !== 'pill') return same;
      return { state: { ...state, look: input.on ? 'pill' : 'ghost', hovered: input.on }, effect: 'show' };
    case 'idle':
      if ((state.look === 'ghost' || state.look === 'pill') && !state.hovered) return hidden;
      return same;
    case 'press':
      if (state.look !== 'ghost' && state.look !== 'pill') return same;
      return ctx.previewOn
        ? { state: { look: 'preview', at: state.at, app: state.app }, effect: 'preview' }
        : { state: { look: 'hidden' }, effect: 'explain' };
    case 'close':
      return state.look === 'preview' ? hidden : same;
    default:
      return same;
  }
}

/**
 * The Quick look's bullets from the streamed text: lines that start with "- " (the server's prompt asks for
 * exactly 3), at most 3, each trimmed and capped. Rendered as plain text with code spans only, never HTML or
 * links (Security A7). A partial last line streams in as it grows.
 */
export function previewBullets(text: string): string[] {
  const bullets: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (!m || !m[1]!.trim()) continue;
    bullets.push(m[1]!.trim().slice(0, 240));
    if (bullets.length === 3) break;
  }
  return bullets;
}

/** The card's header: "debounce · 7 lines", from the first named function, class or const in the selection. */
export function previewTitle(code: string): string {
  const lines = code.replace(/\s+$/, '').split('\n').length;
  const name = /\b(?:function\*?|def|fn|func|class|struct|interface|enum|type)\s+([A-Za-z_$][\w$]*)/.exec(code)?.[1]
    ?? /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(code)?.[1];
  const count = `${lines} ${lines === 1 ? 'line' : 'lines'}`;
  return name ? `${name.slice(0, 40)} · ${count}` : count;
}

/**
 * The three Settings controls, verbatim: the button's help from Security's S-2 on #366/#367 (the same clause on /privacy,
 * /beta and the FAQ: everything the helper watches, and no text read before a press), Quick look's from file 1235, and
 * auto mode's from the lead's draft for Security's S-2 (ledger 646). Bump the version when any text changes.
 */
export const BUBBLE_COPY_VERSION = '2026-11-21';

export function bubbleCopy(shortcut: string): Record<BubbleItem, { label: string; help: string }> {
  return {
    ghost: {
      label: 'Show the Unvibe button when I select code',
      help: `Off until you turn it on. When it's on, Unvibe watches your mouse clicks and scrolling, the pointer's shape, and which app is in front, on your computer, to notice when you select code in a code editor, and shows a small button. It reads no text and sends nothing until you press it (unless you also turn on Explain automatically). Pressing it does the same as ${shortcut}. It doesn't watch your typing and skips password fields and password managers.`,
    },
    preview: {
      label: 'Quick look when I press the button',
      help: "Off until you turn it on. When it's on, pressing the Unvibe button sends your selection to the AI for a short 3-point preview first. That's Claude, or the provider of your own key, and your key pays. Previews don't count toward your free explanations; they have their own smaller daily limit. Open full explanation counts as one explanation. Previews aren't saved to your Library unless you open the full explanation.",
    },
    auto: {
      label: 'Explain automatically when I select code',
      help: 'Off until you turn it on. When you select code in a code editor and leave it selected for a moment, Unvibe copies the selection and sends it to the AI to explain it, without a press. The copy passes through your clipboard, so clipboard history apps may keep it. Each one counts as an explanation. The explanation ends with up to 3 suggested fixes for you to consider. It needs the Unvibe button, so turning the button off turns this off too.',
    },
  };
}

export type BubbleItem = 'ghost' | 'preview' | 'auto';

/** One choice in Settings, kept with the copy version and the time (Security G1; ledger 299 rule 5). */
export interface BubbleChoice {
  item: BubbleItem;
  on: boolean;
  copyVersion: string;
  at: string;
}

/** The latest choice per control; all start off, for new and updated installs alike (G1, A2). */
export function bubbleState(choices: readonly BubbleChoice[]): { ghost: boolean; preview: boolean; auto: boolean } {
  const on: Record<BubbleItem, boolean> = { ghost: false, preview: false, auto: false };
  for (const choice of choices) on[choice.item] = choice.on === true;
  // Quick look and auto mode work only while the button is on (Security 1235: "usable only while Control 1 is on").
  return { ghost: on.ghost, preview: on.ghost && on.preview, auto: on.ghost && on.auto };
}

export function isBubbleChoice(value: unknown): value is BubbleChoice {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (c.item === 'ghost' || c.item === 'preview' || c.item === 'auto') && typeof c.on === 'boolean' && typeof c.copyVersion === 'string' && typeof c.at === 'string';
}

/** Auto mode's guards against accidental spend (ledger 646, the lead's rule 2). */
export const AUTO_SETTLE_MS = 700;
export const AUTO_COOLDOWN_MS = 15_000;
export const AUTO_REPEAT_MS = 10 * 60_000;
const AUTO_MIN_CHARS = 40;
const AUTO_MIN_LINES = 2;

/** At least 2 lines with something on them, or 40 characters: a stray word or a click's selection never sends. */
export function bigEnoughForAuto(code: string): boolean {
  const text = code.trim();
  return text.length >= AUTO_MIN_CHARS || text.split('\n').filter((line) => line.trim()).length >= AUTO_MIN_LINES;
}

/**
 * The 700 ms wait after a mouse-up. `arm` starts it for the button's state at that moment; `cancel` (called on any
 * change to the button: a click, a scroll, a new selection, a press) stops it; and it fires only if the button is
 * still in that same state.
 * While the run it fired for that state is under way, `holds(state)` is true, so the button's 4 s idle waits for it
 * (QA run 6 X8 Cursor: a slow read plus the front-app question passed 4 s, and the idle cancelled a settled start).
 * Idle isn't input: a click, scroll, new selection or app switch still changes the state, which the run checks.
 * `held` is called with the armed state when the hold starts and again when it ends.
 */
export class AutoSettle<S> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: S | null = null;

  constructor(
    private readonly current: () => S,
    private readonly fire: (armed: S) => unknown,
    private readonly ms = AUTO_SETTLE_MS,
    private readonly held: (armed: S) => void = () => undefined,
  ) {}

  arm(armed: S): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.current() === armed) void this.run(armed);
    }, this.ms);
  }

  cancel(): void {
    clearTimeout(this.timer ?? undefined);
    this.timer = null;
  }

  holds(state: S): boolean {
    return this.running !== null && this.running === state;
  }

  private async run(armed: S): Promise<void> {
    this.running = armed;
    this.held(armed);
    try {
      await this.fire(armed);
    } catch {
      /* the run's own failure; the hold still ends */
    } finally {
      // A newer run took over the hold: leave it.
      if (this.running === armed) {
        this.running = null;
        this.held(armed);
      }
    }
  }
}

/** Before reading the selection: read it, or why not. 'show-limit' shows the limit (as a press would), once. */
export type AutoBefore = 'read' | 'busy' | 'cooldown' | 'show-limit' | 'limit';
/** After reading it: start, or why not. */
export type AutoAfter = 'start' | 'small' | 'repeat';

/**
 * Auto mode's memory, in this process only: when it last read a selection, the hashes of the selections it explained in
 * the last 10 minutes (never the text, never stored), and whether the limit was already shown.
 */
export class AutoExplainGate {
  private lastRead = Number.NEGATIVE_INFINITY;
  private readonly recent = new Map<string, number>();
  private limitShown = false;

  /**
   * One explanation in flight at a time (a new selection never cancels it), and 15 s between auto reads, explained or
   * not, so the clipboard (and any clipboard history) sees at most one auto copy every 15 s (Security MUST-A2 on #384).
   * At a limit the limit shows once, and nothing more starts until a selection after it has reset. A 'read' answer
   * starts the 15 s.
   */
  before(now: number, at: { busy: boolean; limited: boolean }): AutoBefore {
    if (at.limited) {
      if (this.limitShown) return 'limit';
      this.limitShown = true;
      return 'show-limit';
    }
    this.limitShown = false;
    if (at.busy) return 'busy';
    if (now - this.lastRead < AUTO_COOLDOWN_MS) return 'cooldown';
    this.lastRead = now;
    return 'read';
  }

  /** The size floor and the 10-minute repeat check, on what was read; a start is remembered here. */
  after(now: number, code: string, hash: string): AutoAfter {
    for (const [seen, at] of this.recent) if (now - at >= AUTO_REPEAT_MS) this.recent.delete(seen);
    if (!bigEnoughForAuto(code)) return 'small';
    if (this.recent.has(hash)) return 'repeat';
    this.recent.set(hash, now);
    return 'start';
  }
}
