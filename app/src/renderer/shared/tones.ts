/** Short UI tones. One AudioContext, resumed on each play so Electron actually hears them. */

export type ToneKind = 'launch' | 'hover' | 'open' | 'click' | 'step' | 'success';

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

const NOTES: Record<ToneKind, number[]> = {
  launch: [392, 523.25, 659.25],
  hover: [523.25],
  open: [392, 523.25],
  click: [659.25, 783.99],
  step: [440],
  success: [523.25, 659.25],
};

export function playUiTone(kind: ToneKind, volume = 0.3, style: 'soft' | 'pixel' = 'soft'): void {
  if (volume <= 0) return;
  const ctx = audio();
  if (!ctx) return;
  const start = () => {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const peak = Math.max(0.0001, volume * (kind === 'hover' ? 0.12 : kind === 'launch' ? 0.22 : 0.16));
    const hold = kind === 'launch' ? 0.32 : kind === 'success' ? 0.24 : 0.14;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + hold);
    gain.connect(ctx.destination);
    NOTES[kind].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = style === 'pixel' ? 'square' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(now + index * 0.05);
      oscillator.stop(now + hold + index * 0.04);
    });
  };
  if (ctx.state === 'suspended') {
    void ctx.resume().then(start).catch(() => { /* Audio stays optional. */ });
    return;
  }
  start();
}
