import { renderRich } from './richText';

/**
 * Splits a short answer's honest "Not sure:" sentence off the 2 to 4 sentences before it, so it can
 * show in the quiet style. Only a "Not sure:" that starts a sentence counts.
 */
export function splitUnsure(text: string): { main: string; unsure: string } {
  const match = /(^|[.!?]\s+)Not sure:/.exec(text);
  if (!match) return { main: text, unsure: '' };
  const at = match.index + match[1].length;
  return { main: text.slice(0, at).trimEnd(), unsure: text.slice(at).trim() };
}

/**
 * The short default answer (product call, 2026-11-02): one plain paragraph, then the "Not sure:" line in the quiet style.
 * `words` fades words in as they arrive (renderRich), in whichever part is still arriving.
 */
export function ShortAnswer({ text, streaming = false, words = false }: { text: string; streaming?: boolean; words?: boolean }) {
  const { main, unsure } = splitUnsure(text);
  return (
    <div className="short-answer">
      {main ? renderRich(main, streaming && !unsure, { words: words && !unsure }) : null}
      {unsure ? <div className="short-answer__unsure">{renderRich(unsure, streaming, { words })}</div> : null}
    </div>
  );
}
