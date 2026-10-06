/** Short UI tones. One AudioContext, resumed on each play so Electron actually hears them. */

export type ToneKind =
  | 'launch' | 'hover' | 'open' | 'click' | 'step' | 'success'
  | 'nav' | 'boop' | 'think' | 'done' | 'correct' | 'wrong' | 'celebrate' | 'talk' | 'key' | 'whoosh';

type ToneStyle = 'soft' | 'pixel';

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/**
 * Each tone is a few notes. `glide` bends a note toward a target pitch, which is what gives
 * Vibe's boop its bubbly, alive sound instead of a flat beep.
 */
interface Note { f: number; at: number; dur: number; glide?: number; gain?: number; wave?: OscillatorType }

const TONES: Record<ToneKind, Note[]> = {
  launch: [{ f: 392, at: 0, dur: 0.3 }, { f: 523.25, at: 0.05, dur: 0.3 }, { f: 659.25, at: 0.1, dur: 0.32 }],
  hover: [{ f: 523.25, at: 0, dur: 0.1, gain: 0.7 }],
  open: [{ f: 392, at: 0, dur: 0.14 }, { f: 523.25, at: 0.05, dur: 0.14 }],
  click: [{ f: 659.25, at: 0, dur: 0.1 }, { f: 783.99, at: 0.04, dur: 0.1 }],
  step: [{ f: 440, at: 0, dur: 0.12 }],
  success: [{ f: 523.25, at: 0, dur: 0.22 }, { f: 659.25, at: 0.05, dur: 0.24 }],
  // A soft wooden tick when you change page.
  nav: [{ f: 880, at: 0, dur: 0.05, glide: 660, gain: 0.55, wave: 'triangle' }],
  // Vibe is happy: a bubbly upward boop.
  boop: [{ f: 420, at: 0, dur: 0.16, glide: 760, wave: 'sine' }, { f: 980, at: 0.1, dur: 0.1, gain: 0.45 }],
  // Vibe starts thinking: a gentle rising whoosh-blip.
  think: [{ f: 300, at: 0, dur: 0.22, glide: 520, gain: 0.6, wave: 'triangle' }],
  // The answer is ready: a small two-note chime.
  done: [{ f: 659.25, at: 0, dur: 0.22 }, { f: 987.77, at: 0.07, dur: 0.3, gain: 0.8 }],
  correct: [{ f: 523.25, at: 0, dur: 0.14 }, { f: 659.25, at: 0.07, dur: 0.14 }, { f: 1046.5, at: 0.14, dur: 0.28, gain: 0.9 }],
  wrong: [{ f: 330, at: 0, dur: 0.18, glide: 220, wave: 'triangle' }],
  // Vibe "talking": one tiny blip per few typed characters. Pitch is varied at play time.
  talk: [{ f: 620, at: 0, dur: 0.045, glide: 700, gain: 0.5, wave: 'triangle' }],
  // A keycap press.
  key: [{ f: 180, at: 0, dur: 0.05, gain: 0.9, wave: 'square' }, { f: 1200, at: 0.005, dur: 0.03, gain: 0.25 }],
  // A panel sliding in.
  whoosh: [{ f: 260, at: 0, dur: 0.28, glide: 900, gain: 0.45, wave: 'sine' }],
  celebrate: [
    { f: 523.25, at: 0, dur: 0.14 }, { f: 659.25, at: 0.07, dur: 0.14 }, { f: 783.99, at: 0.14, dur: 0.14 },
    { f: 1046.5, at: 0.21, dur: 0.36, gain: 0.9 }, { f: 1318.5, at: 0.27, dur: 0.3, gain: 0.35 },
  ],
};

const LEVEL: Partial<Record<ToneKind, number>> = { hover: 0.12, launch: 0.22, nav: 0.1, think: 0.12, talk: 0.08, key: 0.14, whoosh: 0.1 };

export function playUiTone(kind: ToneKind, volume = 0.3, style: ToneStyle = 'soft'): void {
  if (volume <= 0) return;
  const ctx = audio();
  if (!ctx) return;
  const start = () => {
    const now = ctx.currentTime;
    const level = volume * (LEVEL[kind] ?? 0.16);
    for (const note of TONES[kind]) {
      const t0 = now + note.at;
      const gain = ctx.createGain();
      const peak = Math.max(0.0001, level * (note.gain ?? 1));
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);
      gain.connect(ctx.destination);
      const oscillator = ctx.createOscillator();
      oscillator.type = style === 'pixel' ? 'square' : (note.wave ?? 'sine');
      const jitter = kind === 'talk' ? 0.85 + Math.random() * 0.4 : 1;
      oscillator.frequency.setValueAtTime(note.f * jitter, t0);
      if (note.glide) oscillator.frequency.exponentialRampToValueAtTime(note.glide * jitter, t0 + note.dur * 0.8);
      oscillator.connect(gain);
      oscillator.start(t0);
      oscillator.stop(t0 + note.dur + 0.02);
    }
  };
  if (ctx.state === 'suspended') {
    void ctx.resume().then(start).catch(() => { /* Audio stays optional. */ });
    return;
  }
  start();
}

/** Per-window sound preferences, so any component can play a tone without prop drilling. */
const prefs: { enabled: boolean; volume: number; style: ToneStyle } = { enabled: true, volume: 0.3, style: 'soft' };

export function configureTones(next: Partial<{ enabled: boolean; volume: number; style: ToneStyle }>): void {
  Object.assign(prefs, next);
}

export function playTone(kind: ToneKind): void {
  if (!prefs.enabled) return;
  playUiTone(kind, prefs.volume, prefs.style);
}
