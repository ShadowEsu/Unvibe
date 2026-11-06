import { useEffect, useState } from 'react';

/** richWordIn's length (widget.css): how long word spans stay after the reveal, so the last words finish fading. */
export const WORD_FADE_MS = 120;

/**
 * One frame of the answer's progressive reveal (SPEC §6 word fade; Motion, app-0151 moment 4). It catches the shown
 * text up to the streamed buffer by about a tenth of what's waiting, but stops only at word boundaries, so a word
 * never shows half and then grows letters. While streaming, a last word with no space after it yet waits for the
 * rest; once the answer is done it shows. `more` says whether another frame has something to reveal.
 */
export function revealStep(shown: string, full: string, streaming: boolean): { text: string; more: boolean } {
  if (shown.length >= full.length) return { text: full, more: false };
  const limit = streaming ? Math.max(shown.length, full.search(/\S*$/)) : full.length;
  if (shown.length >= limit) return { text: shown, more: false };
  const remaining = limit - shown.length;
  const step = Math.min(remaining, Math.max(2, Math.ceil(remaining / 10)));
  const gap = full.slice(shown.length + step, limit).search(/\s/);
  const text = full.slice(0, gap < 0 ? limit : shown.length + step + gap);
  return { text, more: text.length < limit };
}

export interface Revealed {
  /** What to show now. */
  text: string;
  /** Streaming, or still catching up with what has arrived. */
  typing: boolean;
  /** Wrap words so they fade in (renderRich `words`): while typing and for one fade after; never with reduced motion. */
  words: boolean;
}

/**
 * ChatGPT-style progressive reveal of streamed text, one revealStep per frame, for the answer and for More detail.
 * While `live` (streaming or done) the shown text catches up with `full`; otherwise `full` shows as it is. The effect
 * re-runs as text arrives and when streaming ends, which lets a held last word show. `resetKey` (the tab) starts over.
 */
export function useRevealedText(full: string, streaming: boolean, live: boolean, resetKey: string): Revealed {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!live || full.length === 0) {
      setShown('');
      return undefined;
    }
    let cancelled = false;
    let frame = 0;
    const tick = () => {
      if (cancelled) return;
      setShown((prev) => {
        const { text, more } = revealStep(prev, full, streaming);
        if (more) frame = requestAnimationFrame(tick);
        return text;
      });
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [full, streaming, live, resetKey]);
  const typing = live && (streaming || shown.length < full.length);
  // The words stay wrapped for one fade after the reveal ends, so the last ones finish their 120 ms instead of snapping.
  const [linger, setLinger] = useState(false);
  useEffect(() => {
    if (typing) {
      setLinger(true);
      return undefined;
    }
    const t = window.setTimeout(() => setLinger(false), WORD_FADE_MS);
    return () => window.clearTimeout(t);
  }, [typing]);
  const words = (typing || linger) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { text: live ? shown : full, typing, words };
}
