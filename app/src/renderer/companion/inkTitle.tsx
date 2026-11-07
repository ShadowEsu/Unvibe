import type { CSSProperties } from 'react';

/** Letters ink in over at most this long, whatever the title's length. */
const SPREAD_MS = 420;

/**
 * A page title that inks in once when the page opens (SP6; Motion site-562 §3 adapted to the app): each letter goes
 * from 15 % to full ink, left to right, opacity only. The letters are inline spans, so the heading's accessible name
 * and copied text stay the plain words. Words stay unbreakable. Reduced motion: the global rule removes the
 * animation, so the title shows at full ink straight away. Page titles only, never body text.
 */
export function InkTitle({ text }: { text: string }) {
  const step = Math.min(24, SPREAD_MS / (text.length || 1));
  let index = 0;
  return (
    <span className="ink-title">
      {text.split(/(\s+)/).map((part, w) => (/^\s+$/.test(part) ? part : (
        <span className="ink-title__word" key={w}>
          {[...part].map((ch) => {
            const style = { '--ink-delay': `${Math.round(index++ * step)}ms` } as CSSProperties;
            return <span className="ink-title__ch" style={style} key={index}>{ch}</span>;
          })}
        </span>
      )))}
    </span>
  );
}
