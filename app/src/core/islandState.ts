/**
 * Island state machine (pure, no I/O — unit tested).
 *
 * One source of truth that maps a *product* state (what Unvibe is doing) to a
 * *presentation* (how the island should look) plus the human narration, an accent,
 * an optional sound, and completion-dwell timing. The main process feeds product
 * states in; the bar renderer reflects the resolved presentation. This is the
 * "state-driven island" the redesign called for — backend events never resize
 * windows directly, they map through here.
 */

/** What Unvibe is doing. Distinct from presentation. */
export type ProductState =
  | 'idle'
  | 'selectionDetected'
  | 'choosingDepth'
  | 'capturingContext'
  | 'generating'
  | 'streaming'
  | 'explanationReady'
  | 'followUp'
  | 'saving'
  | 'saved'
  | 'copied'
  | 'milestone'
  | 'suggestion'
  | 'announcement'
  | 'offline'
  | 'permissionRequired'
  | 'authenticationExpired'
  | 'rateLimited'
  | 'parseFailure'
  | 'serviceError';

/** How much of the island is shown. A layout state, not a product state. */
export type Presentation = 'hidden' | 'dormant' | 'micro' | 'compact' | 'expanded' | 'fullCard';

/** Drives color: calm by default, restrained accents for status. */
export type Accent = 'idle' | 'active' | 'success' | 'warning' | 'error';

/** Named sound events (see core/sound.ts for the palette). null = silent. */
export type SoundEvent =
  | 'capture'
  | 'ready'
  | 'saved'
  | 'copied'
  | 'milestone'
  | 'warning'
  | 'error'
  | null;

export interface IslandView {
  state: ProductState;
  presentation: Presentation;
  /** Short, humane status line shown in the strip (aria-live). */
  narration: string;
  accent: Accent;
  /** Sound to play on *entering* this state (subject to sound gating elsewhere). */
  sound: SoundEvent;
  /**
   * Glance completion: a finished/notable state that stays compact with a status dot
   * instead of forcing an expansion. The strip shows the dot + narration.
   */
  glance: boolean;
  /** How long a transient success/notice should linger before it may collapse (ms). */
  dwellMs: number;
}

interface Rule {
  presentation: Presentation;
  narration: string;
  accent: Accent;
  sound: SoundEvent;
  glance?: boolean;
  dwellMs?: number;
}

/**
 * The mapping table. Deliberately calm: most states are `compact`; only the depth
 * picker and the ready/expanded result grow larger. Errors are quiet-but-clear.
 */
const RULES: Record<ProductState, Rule> = {
  idle: { presentation: 'dormant', narration: 'Ready to understand', accent: 'idle', sound: null },
  selectionDetected: { presentation: 'compact', narration: 'Code captured', accent: 'active', sound: 'capture' },
  choosingDepth: { presentation: 'expanded', narration: 'Choose a depth', accent: 'active', sound: null },
  capturingContext: { presentation: 'compact', narration: 'Reading your code in context', accent: 'active', sound: null },
  generating: { presentation: 'compact', narration: 'Connecting related concepts', accent: 'active', sound: null },
  streaming: { presentation: 'compact', narration: 'Explaining', accent: 'active', sound: null },
  explanationReady: { presentation: 'compact', narration: 'Explanation ready', accent: 'success', sound: 'ready', glance: true, dwellMs: 3200 },
  followUp: { presentation: 'expanded', narration: 'Ask a follow-up', accent: 'active', sound: null },
  saving: { presentation: 'compact', narration: 'Saving', accent: 'active', sound: null },
  saved: { presentation: 'compact', narration: 'Saved to your learning', accent: 'success', sound: 'saved', glance: true, dwellMs: 2400 },
  copied: { presentation: 'compact', narration: 'Copied', accent: 'success', sound: 'copied', glance: true, dwellMs: 1600 },
  milestone: { presentation: 'compact', narration: 'Nice work', accent: 'success', sound: 'milestone', glance: true, dwellMs: 4200 },
  suggestion: { presentation: 'compact', narration: 'A suggestion', accent: 'active', sound: null, glance: true, dwellMs: 4800 },
  announcement: { presentation: 'compact', narration: 'What’s new', accent: 'active', sound: null, glance: true, dwellMs: 4800 },
  offline: { presentation: 'compact', narration: 'You appear to be offline', accent: 'warning', sound: 'warning', glance: true, dwellMs: 4000 },
  permissionRequired: { presentation: 'compact', narration: 'Enable Accessibility for Unvibe', accent: 'warning', sound: 'warning', glance: true, dwellMs: 5000 },
  authenticationExpired: { presentation: 'compact', narration: 'Your session expired', accent: 'warning', sound: 'warning', glance: true, dwellMs: 5000 },
  rateLimited: { presentation: 'compact', narration: 'You’re out of explanations for now', accent: 'warning', sound: 'warning', glance: true, dwellMs: 5000 },
  parseFailure: { presentation: 'compact', narration: 'We couldn’t read that cleanly', accent: 'warning', sound: 'warning', glance: true, dwellMs: 4000 },
  serviceError: { presentation: 'compact', narration: 'Explanation interrupted', accent: 'error', sound: 'error', glance: true, dwellMs: 4200 },
};

const DEFAULT_DWELL = 0;

/** Resolve a product state to its full island presentation. Pure. */
export function resolveIsland(state: ProductState): IslandView {
  const rule = RULES[state] ?? RULES.idle;
  return {
    state,
    presentation: rule.presentation,
    narration: rule.narration,
    accent: rule.accent,
    sound: rule.sound,
    glance: rule.glance ?? false,
    dwellMs: rule.dwellMs ?? DEFAULT_DWELL,
  };
}

/** True when a state is a transient notice that should auto-return to dormant. */
export function isTransient(state: ProductState): boolean {
  return resolveIsland(state).dwellMs > 0;
}

/** The set of states the app currently narrates (useful for exhaustiveness tests). */
export const PRODUCT_STATES = Object.keys(RULES) as ProductState[];
