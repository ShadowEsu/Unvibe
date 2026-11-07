import { renderRich } from '../shared/richText';

/**
 * One follow-up about the current selection (Design ruling b: they belong to it, and a new selection replaces them).
 * `waiting`: sent, nothing back yet; main streams the answer like an explanation.
 */
export interface FollowUp {
  id: number;
  question: string;
  answer: string;
  phase: 'waiting' | 'streaming' | 'done' | 'error';
  error?: string;
}

/** True while a follow-up is on its way, so the Ask footer offers only Stop generating. */
export function followUpLive(followUps: FollowUp[]): boolean {
  const last = followUps.at(-1);
  return last?.phase === 'waiting' || last?.phase === 'streaming';
}

/** The Ask tab's thread: each question as asked, then the answer as it streams. */
export function AskThread({ followUps }: { followUps: FollowUp[] }) {
  return (
    <ol className="ob-thread" aria-label="Follow-up questions">
      {followUps.map((f) => (
        <li key={f.id} className="ob-thread__turn">
          <p className="ob-thread__q">{f.question}</p>
          <div className="ob-answer" aria-live="polite">
            {f.answer ? renderRich(f.answer, f.phase === 'streaming') : f.phase === 'waiting' || f.phase === 'streaming' ? <span className="cursor" /> : null}
          </div>
          {f.phase === 'error' ? <p className="ob-sub" role="alert">{f.error}</p> : null}
        </li>
      ))}
    </ol>
  );
}
