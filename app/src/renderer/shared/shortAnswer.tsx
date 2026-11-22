import { renderRich } from './richText';

/**
 * Splits a short answer's honest "Not sure:" sentence off the 2 to 4 sentences before it, so it can
 * show in the quiet style. Only a "Not sure:" that starts a sentence, before any heading, counts. What
 * follows it after a blank line (auto mode's "Suggested fixes" section, ledger 646) is `after`, shown
 * in the normal style.
 */
export function splitUnsure(text: string): { main: string; unsure: string; after: string } {
  const heading = /(^|\n)#{1,6}\s/.exec(text);
  const match = /(^|[.!?]\s+)Not sure:/.exec(heading ? text.slice(0, heading.index) : text);
  if (!match) return { main: text, unsure: '', after: '' };
  const at = match.index + match[1].length;
  const tail = text.slice(at);
  const end = tail.search(/\n\s*\n/);
  return {
    main: text.slice(0, at).trimEnd(),
    unsure: (end < 0 ? tail : tail.slice(0, end)).trim(),
    after: end < 0 ? '' : tail.slice(end).trim(),
  };
}

/**
 * The short default answer (product call, 2026-11-02): one plain paragraph, then the "Not sure:" line in the quiet style,
 * then anything after it (Suggested fixes). `words` fades words in as they arrive (renderRich), in whichever part is
 * still arriving.
 */
export function ShortAnswer({ text, streaming = false, words = false }: { text: string; streaming?: boolean; words?: boolean }) {
  const { main, unsure, after } = splitUnsure(text);
  const mainLast = !unsure && !after;
  return (
    <div className="short-answer">
      {main ? renderRich(main, streaming && mainLast, { words: words && mainLast }) : null}
      {unsure ? <div className="short-answer__unsure">{renderRich(unsure, streaming && !after, { words: words && !after })}</div> : null}
      {after ? renderRich(after, streaming, { words }) : null}
    </div>
  );
}
