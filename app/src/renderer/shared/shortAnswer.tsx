import { useEffect, useRef, useState, type ReactNode } from 'react';
import { renderInline, renderRich } from './richText';
import { linesLabel } from '../../core/linesLabel';

/** The skeleton's crossfade out, matching --dur-exit in tokens.css. */
const EXIT_MS = 150;

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

export interface Sentence {
  text: string;
  /** Which paragraph it belongs to (a blank line starts the next one). */
  paragraph: number;
  /** Where it ends in the text it came from. */
  end: number;
}

/** Quotes and brackets that may close a sentence after its end punctuation. */
const CLOSERS = `"')]’”`;

/**
 * The complete sentences of `text`. A sentence is complete at end punctuation followed by white space, or at a
 * blank line, never inside `code` or **bold**; the trailing partial sentence only counts once the stream has `ended`.
 * Punctuation at the very end of what has arrived waits for the next token: "config." may still become "config.json".
 */
export function sentencesOf(text: string, ended: boolean): Sentence[] {
  const out: Sentence[] = [];
  const n = text.length;
  let start = 0;
  let paragraph = 0;
  let code = false;
  let bold = false;
  let i = 0;
  while (i < n) {
    const ch = text[i]!;
    if (ch === '`') { code = !code; i += 1; continue; }
    if (code) { i += 1; continue; }
    if (ch === '*' && text[i + 1] === '*') { bold = !bold; i += 2; continue; }
    let end = -1;
    if (ch === '.' || ch === '!' || ch === '?') {
      let j = i + 1;
      while (j < n) {
        if (bold && text.startsWith('**', j)) { bold = false; j += 2; } else if (CLOSERS.includes(text[j]!)) j += 1; else break;
      }
      if (!bold && j < n && /\s/.test(text[j]!)) end = j;
      if (end < 0) { i = j; continue; }
    } else if (ch === '\n' && /^\n[ \t]*\n/.test(text.slice(i, i + 64))) {
      end = i;
    } else {
      i += 1;
      continue;
    }
    const sentence = text.slice(start, end).trim();
    if (sentence) out.push({ text: sentence, paragraph, end });
    let k = end;
    let newlines = 0;
    while (k < n && /\s/.test(text[k]!)) { if (text[k] === '\n') newlines += 1; k += 1; }
    if (newlines >= 2 && sentence) paragraph += 1;
    start = k;
    i = k;
  }
  const rest = text.slice(start).trim();
  if (ended && rest) out.push({ text: rest, paragraph, end: n });
  return out;
}

/**
 * What a short answer shows so far: its complete sentences, and the "Not sure:" line once the stream has ended.
 * A "Not sure:" that has started means every sentence before it is complete.
 */
export function revealShortAnswer(text: string, streaming: boolean): { sentences: Sentence[]; unsure: string } {
  const { main, unsure } = splitUnsure(text);
  return { sentences: sentencesOf(main, !streaming || Boolean(unsure)), unsure: streaming ? '' : unsure };
}

/**
 * Whether the answer is still arriving on screen: a short answer until its stream ends (its sentences show as they
 * complete), a full one until the typing catches up with the text. More detail, the arrival scroll and the actions wait.
 */
export function answerArriving(phase: string, short: boolean, shownLength: number, textLength: number): boolean {
  return phase === 'streaming' || (phase === 'done' && !short && shownLength < textLength);
}

/** "More detail" mounts once, under a short answer that is all on screen. */
export function offersMoreDetail(phase: string, short: boolean, shownLength: number, textLength: number): boolean {
  return short && phase === 'done' && !answerArriving(phase, short, shownLength, textLength);
}

/** How the waiting line names the selection's language (ids from core/language.ts). */
const LANGUAGE_NAMES: Record<string, string> = {
  c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go', html: 'HTML', java: 'Java', javascript: 'JavaScript',
  javascriptreact: 'JavaScript', json: 'JSON', 'objective-c': 'Objective-C', 'objective-cpp': 'Objective-C++',
  php: 'PHP', python: 'Python', ruby: 'Ruby', rust: 'Rust', shell: 'shell script', sql: 'SQL', swift: 'Swift',
  typescript: 'TypeScript', typescriptreact: 'TypeScript', yaml: 'YAML',
};

/** The quiet line under the waiting skeleton, saying what Unvibe is reading: "Reading 24 lines of TypeScript…". */
export function waitingStatus(lines?: number, language?: string): string {
  if (!lines || lines < 1) return 'Reading your request…';
  return `Reading ${linesLabel(lines)} of ${(language && LANGUAGE_NAMES[language]) || 'code'}…`;
}

/** Before the first words: three skeleton lines at the answer's line height, and what is happening. No spinner. */
export function AnswerWait({ status, leaving = false }: { status: string; leaving?: boolean }) {
  return (
    <div className={`answer-wait${leaving ? ' answer-wait--leaving' : ''}`} role={leaving ? undefined : 'status'} aria-hidden={leaving || undefined}>
      <div className="answer-skeleton" aria-hidden="true"><i /><i /><i /></div>
      <p className="answer-wait__status">{status}</p>
    </div>
  );
}

/** Lists, headings and code fences: a short answer should have none, but if it does they render as blocks. */
const BLOCK_MARKDOWN = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s)|```/m;

/** Complete sentences as fading spans, one `p` per paragraph. */
function renderSentences(sentences: Sentence[]): ReactNode[] {
  const paragraphs: ReactNode[][] = [];
  sentences.forEach((sentence, index) => {
    const parts = (paragraphs[sentence.paragraph] ??= []);
    if (parts.length) parts.push(' ');
    parts.push(<span key={index} className="short-answer__sentence">{renderInline(sentence.text)}</span>);
  });
  return paragraphs.map((parts, index) => <p key={`t0-p${index}`}>{parts}</p>);
}

/**
 * The short default answer (Preston 2026-11-02): one plain paragraph, then the "Not sure:" line in the quiet style.
 * One that streams here waits with the skeleton and `status`, crossfades to its first sentence, then shows each
 * sentence as it completes (never a partial one, never a caret); the "Not sure:" line follows when the stream ends.
 */
export function ShortAnswer({ text, streaming = false, status = 'Reading your selection…' }: { text: string; streaming?: boolean; status?: string }) {
  // An answer that streamed in this view keeps its sentence spans when it ends, so its last sentence fades in too.
  const arrived = useRef(streaming);
  if (streaming) arrived.current = true;
  const { sentences, unsure } = revealShortAnswer(text, streaming);
  const waiting = streaming && sentences.length === 0;
  const leaving = useSkeletonExit(waiting);
  const { main } = splitUnsure(text);

  if (!arrived.current) {
    return (
      <div className="short-answer">
        {main ? renderRich(main) : null}
        {unsure ? <div className="short-answer__unsure">{renderRich(unsure)}</div> : null}
      </div>
    );
  }
  const last = sentences[sentences.length - 1];
  const shown = BLOCK_MARKDOWN.test(main) ? (last ? renderRich(main.slice(0, last.end)) : null) : renderSentences(sentences);
  return (
    <div className="short-answer short-answer--arriving">
      {waiting || leaving ? <AnswerWait status={status} leaving={!waiting} /> : null}
      {shown}
      {unsure ? <div className="short-answer__unsure">{renderRich(unsure)}</div> : null}
    </div>
  );
}

/** True for the skeleton's crossfade out, from the moment waiting ends. */
function useSkeletonExit(waiting: boolean): boolean {
  const [leaving, setLeaving] = useState(false);
  const wasWaiting = useRef(waiting);
  useEffect(() => {
    const ended = wasWaiting.current && !waiting;
    wasWaiting.current = waiting;
    if (!ended) return;
    setLeaving(true);
    const timer = window.setTimeout(() => setLeaving(false), EXIT_MS);
    return () => {
      window.clearTimeout(timer);
      setLeaving(false);
    };
  }, [waiting]);
  return leaving;
}
