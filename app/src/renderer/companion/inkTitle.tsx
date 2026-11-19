import type { CSSProperties } from 'react';

/**
 * The last letter starts inking at most this long after the first, whatever the title's length; with each letter's
 * 140 ms (app-0151.css `.ink-title__ch`) every title is fully inked by 240 ms (Design motion review 07 Nov SHOULD 1).
 */
const SPREAD_MS = 100;

/**
 * A page title that inks in once when the page opens (SP6; Motion site-562 §3 adapted to the app): each letter goes
 * from 15 % to full ink, left to right, opacity only. The letters are inline spans with no space between them, so
 * lines still break only where the words do, and the heading's accessible name and copied text stay the plain words.
 * Reduced motion: the global rule removes the animation, so the title shows at full ink straight away. Page titles
 * only, never body text.
 */
export function InkTitle({ text }: { text: string }) {
  const step = Math.min(24, SPREAD_MS / (text.length || 1));
  let index = 0;
  return (
    <span className="ink-title">
      {[...text].map((ch, i) => (/\s/.test(ch) ? ch : (
        <span className="ink-title__ch" style={{ '--ink-delay': `${Math.round(index++ * step)}ms` } as CSSProperties} key={i}>{ch}</span>
      )))}
    </span>
  );
}
