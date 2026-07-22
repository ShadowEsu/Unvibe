/**
 * Island coordinator (main process).
 *
 * The single place product states become island presentations. Backend/review events
 * call setIslandState(); this resolves the presentation (core/islandState) and pushes
 * it to the bar renderer, and decides whether to play a sound (core/sound) — emitting
 * an `island:sound` event the bar synthesizes. Windows are never resized from here;
 * the bar reflects the pushed presentation itself.
 */
import { powerMonitor, type BrowserWindow } from 'electron';
import { resolveIsland, type ProductState, type IslandView } from '../core/islandState';
import { shouldPlaySound, type SoundGate } from '../core/sound';
import { settings } from './settings';
import { showBar } from './windows';

let bar: BrowserWindow | null = null;
let screenLocked = false;
let current: ProductState = 'idle';

export function setIslandBar(win: BrowserWindow): void {
  bar = win;
  if (process.platform === 'darwin') {
    powerMonitor.on('lock-screen', () => (screenLocked = true));
    powerMonitor.on('unlock-screen', () => (screenLocked = false));
  }
}

export function currentIslandState(): ProductState {
  return current;
}

function gate(): SoundGate {
  const s = settings().all();
  return {
    soundEffects: s.soundEffects,
    soundMilestones: s.soundMilestones,
    quietWhileLocked: s.quietWhileLocked,
    inQuietHours: settings().inQuietHours(),
    screenLocked,
  };
}

/**
 * Move the island to a product state. Pushes the resolved view to the bar and plays
 * the state's sound if the gate allows. `show` reveals the bar first (e.g. when a
 * review begins) — transient notices don't force it visible.
 */
export function setIslandState(
  state: ProductState,
  opts: { show?: boolean; narration?: string; detail?: string } = {},
): IslandView {
  current = state;
  const base = resolveIsland(state);
  const view: IslandView = opts.narration ? { ...base, narration: opts.narration } : base;
  const s = settings().all();
  // Glance mode off → a "ready" success may expand instead of staying a quiet dot.
  const effectiveGlance = view.glance && s.glanceMode;

  if (bar && !bar.isDestroyed()) {
    if (opts.show) showBar(bar);
    bar.webContents.send('island:state', { ...view, glance: effectiveGlance, detail: opts.detail });
    if (view.sound && shouldPlaySound(view.sound, gate())) {
      bar.webContents.send('island:sound', view.sound);
    }
  }
  return view;
}
