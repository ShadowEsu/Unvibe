/** The frame and timer calls signalFirstScreen uses (the browser's by default; a test passes its own). */
export interface FrameClock {
  raf: (cb: () => void) => number;
  cancelRaf: (id: number) => void;
  setTimer: (cb: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
}

const browserClock = (): FrameClock => ({
  raf: (cb) => window.requestAnimationFrame(cb),
  cancelRaf: (id) => window.cancelAnimationFrame(id),
  setTimer: (cb, ms) => window.setTimeout(cb, ms),
  clearTimer: (id) => window.clearTimeout(id),
});

/**
 * Calls `send` once the first real screen has been drawn (#208): two frames after this is called, so the screen has
 * been painted, or after `timeoutMs` if the hidden window gets no frames, whichever comes first. It sends once. The
 * returned cleanup stops both and sends if neither has fired yet, so a screen replaced at once still shows the window.
 */
export function signalFirstScreen(send: () => void, timeoutMs = 120, clock: FrameClock = browserClock()): () => void {
  let sent = false;
  const once = () => {
    if (sent) return;
    sent = true;
    clock.cancelRaf(frame);
    clock.clearTimer(timer);
    send();
  };
  let frame = clock.raf(() => { frame = clock.raf(once); });
  const timer = clock.setTimer(once, timeoutMs);
  return once;
}
