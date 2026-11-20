/**
 * The Unvibe button (D5 A) and its Quick look (D5 T3): the pure parts.
 *
 * A small native helper watches the mouse (never the keyboard, Security G3) and reports one JSON line per
 * gesture. Main decides from those lines alone whether the ghost shows: only in an allowed code editor, only
 * after a mouse selection, never in a denied app. In editors nothing is read before a press (Security G2 as
 * clarified 7 Nov); a press runs exactly the Control+U path (G7), or with Quick look on, a 3-bullet preview.
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
  /** A mouse selection ended: a drag that started over text, or a double or triple click over text. */
  | { e: 'select'; x: number; y: number; app: string; g: 'drag' | 'double' | 'triple' }
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
 * selection, and a line that tried to would not parse: no event has a field for it.
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
    case 'select':
      return coord(o.x) && coord(o.y) && appId(o.app) && typeof o.g === 'string' && GESTURES.has(o.g)
        ? { e: 'select', x: o.x, y: o.y, app: o.app, g: o.g as 'drag' | 'double' | 'triple' }
        : null;
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
 * Where the ghost goes for a mouse-up point. Editors report no selection bounds we may read, so the point is
 * Design's fallback (Q1). It sits to the right, or flips left near the work area's right edge, so the resting
 * cursor and the drag's own mouse-up are never over it (G7), and it never leaves the work area (below the
 * menu bar). `flipped` tells the pill and the card which way to grow.
 */
export function ghostPlacement(at: Point, workArea: Rect, pillWidth = PILL_WIDTH): { x: number; y: number; flipped: boolean } {
  const right = at.x + GHOST_GAP;
  const flipped = right + pillWidth > workArea.x + workArea.width;
  const x = flipped ? at.x - GHOST_GAP - GHOST_SIZE : right;
  const y = at.y - GHOST_SIZE / 2;
  return {
    x: Math.round(within(x, workArea.x, workArea.x + workArea.width - GHOST_SIZE)),
    y: Math.round(within(y, workArea.y, workArea.y + workArea.height - GHOST_SIZE)),
    flipped,
  };
}

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
      if (state.look === 'hidden') return same;
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
 * The two Settings controls, verbatim: the button's help from Security's S-1 on #366 (SHOULD-366b, editors only, no
 * text read before a press), Quick look's from file 1235. Bump the version when either text changes.
 */
export const BUBBLE_COPY_VERSION = '2026-11-19';

export function bubbleCopy(shortcut: string): { ghost: { label: string; help: string }; preview: { label: string; help: string } } {
  return {
    ghost: {
      label: 'Show the Unvibe button when I select code',
      help: `Off until you turn it on. When it's on, Unvibe watches your mouse clicks, on your computer, to notice when you select code in a code editor, and shows a small button. It reads nothing until you press it. Nothing is sent until you press the button, and pressing it does the same as ${shortcut}. It doesn't watch your typing and skips password fields and password managers.`,
    },
    preview: {
      label: 'Quick look when I press the button',
      help: "Off until you turn it on. When it's on, pressing the Unvibe button sends your selection to the AI for a short 3-point preview first. That's Claude, or the provider of your own key, and your key pays. Previews don't count toward your free explanations; they have their own smaller daily limit. Open full explanation counts as one explanation. Previews aren't saved to your Library unless you open the full explanation.",
    },
  };
}

export type BubbleItem = 'ghost' | 'preview';

/** One choice in Settings, kept with the copy version and the time (Security G1; ledger 299 rule 5). */
export interface BubbleChoice {
  item: BubbleItem;
  on: boolean;
  copyVersion: string;
  at: string;
}

/** The latest choice per control; both start off, for new and updated installs alike (G1, A2). */
export function bubbleState(choices: readonly BubbleChoice[]): { ghost: boolean; preview: boolean } {
  let ghost = false;
  let preview = false;
  for (const choice of choices) {
    if (choice.item === 'ghost') ghost = choice.on === true;
    if (choice.item === 'preview') preview = choice.on === true;
  }
  // Quick look works only while the button is on (Security 1235: "usable only while Control 1 is on").
  return { ghost, preview: ghost && preview };
}

export function isBubbleChoice(value: unknown): value is BubbleChoice {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (c.item === 'ghost' || c.item === 'preview') && typeof c.on === 'boolean' && typeof c.copyVersion === 'string' && typeof c.at === 'string';
}
