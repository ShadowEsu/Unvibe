/**
 * Tiny moments of feedback for the site: a soft "boop" (Vibe's sound from the app) and a light
 * haptic tap on phones. Only ever runs inside a user gesture, so it never autoplays.
 */
let ctx: AudioContext | null = null;

export function boop(): void {
  try {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = ctx ?? new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const notes: Array<[number, number, number, number?]> = [[420, 0, 0.16, 760], [980, 0.1, 0.1]];
    for (const [f, at, dur, glide] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + at);
      if (glide) osc.frequency.exponentialRampToValueAtTime(glide, now + at + dur * 0.8);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.05, now + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + dur + 0.02);
    }
  } catch {
    /* sound is optional */
  }
}

export function tap(): void {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* haptics are optional */
  }
}

export function delight(): void {
  boop();
  tap();
}
