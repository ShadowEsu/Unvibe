import { useEffect, useRef, useState } from 'react';
import { renderRich } from './richText';
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

/**
 * The short default answer (Preston 2026-11-02): one plain paragraph, then the "Not sure:" line in the quiet style.
 * While `streaming` with nothing to show yet it waits with the skeleton and `status`; the skeleton then crossfades to the text.
 */
export function ShortAnswer({ text, streaming = false, status = 'Reading your selection…' }: { text: string; streaming?: boolean; status?: string }) {
  const { main, unsure } = splitUnsure(text);
  const waiting = streaming && !text.trim();
  const leaving = useSkeletonExit(waiting);
  return (
    <div className="short-answer">
      {waiting || leaving ? <AnswerWait status={status} leaving={!waiting} /> : null}
      {main ? renderRich(main, streaming && !unsure) : null}
      {unsure ? <div className="short-answer__unsure">{renderRich(unsure, streaming)}</div> : null}
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
