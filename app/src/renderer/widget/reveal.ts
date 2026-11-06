import { useEffect, useState } from 'react';
import { HAS_WORD } from '../shared/richText';

/** richWordIn's length (widget.css): how long word spans stay after the reveal, so the last words finish fading. */
export const WORD_FADE_MS = 120;

/**
 * One frame of the answer's progressive reveal (SPEC §6 word fade; Motion, app-0151 moment 4). It catches the shown
 * text up to the streamed buffer by about a tenth of what's waiting, but only ever stops between two words: two
 * tokens that both have a letter or digit, with only whitespace between. Those are exactly the boundaries of
 * renderRich's word units (punctuation rides with a word), so a word never shows half, and its punctuation never
 * turns up after it has faded in. While streaming, a boundary waits until the token after it is known to be a word;
 * once the answer is done, the end shows. `more` says whether another frame has something to reveal.
 */
export function revealStep(shown: string, full: string, streaming: boolean): { text: string; more: boolean } {
  if (shown.length >= full.length) return { text: full, more: false };
  const cuts: number[] = [];
  let prev: { end: number; word: boolean } | null = null;
  for (const m of full.matchAll(/\S+/g)) {
    const word = HAS_WORD.test(m[0]);
    if (prev && prev.word && word && prev.end > shown.length) cuts.push(prev.end);
    prev = { end: m.index + m[0].length, word };
  }
  if (!streaming) cuts.push(full.length);
  const last = cuts.at(-1);
  if (last === undefined) return { text: shown, more: false };
  const step = Math.max(2, Math.ceil((last - shown.length) / 10));
  const cut = cuts.find((c) => c >= shown.length + step) ?? last;
  return { text: full.slice(0, cut), more: cut < last };
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
