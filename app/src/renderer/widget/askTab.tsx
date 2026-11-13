import { useEffect, useRef, useState } from 'react';
import { Buddy, REACTION_HOLD_MS } from '../shared/buddy';
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

/**
 * Vibe beside an answer (Mono): thinking while it writes, happy (2 hops) for REACTION_HOLD_MS when it lands, then at
 * rest. An answer already finished when the thread opens starts at rest.
 */
function TurnVibe({ phase }: { phase: FollowUp['phase'] }) {
  const live = phase === 'waiting' || phase === 'streaming';
  const wasLive = useRef(live);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const landedNow = wasLive.current && phase === 'done';
    wasLive.current = live;
    if (!landedNow) return undefined;
    setLanded(true);
    const back = window.setTimeout(() => setLanded(false), REACTION_HOLD_MS);
    return () => window.clearTimeout(back);
  }, [phase, live]);
  return (
    <div className="ob-thread__who">
      <Buddy mood={live ? 'thinking' : landed ? 'happy' : 'idle'} size={20} label={live ? 'Vibe is thinking' : 'Vibe'} />
      <span aria-hidden="true">Vibe</span>
    </div>
  );
}

/** The Ask tab's thread: each question as asked (a grey tile at the right), then Vibe and the answer as it streams. */
export function AskThread({ followUps }: { followUps: FollowUp[] }) {
  return (
    <ol className="ob-thread" aria-label="Follow-up questions">
      {followUps.map((f) => (
        <li key={f.id} className="ob-thread__turn">
          <p className="ob-thread__q">{f.question}</p>
          <TurnVibe phase={f.phase} />
          <div className="ob-answer" aria-live="polite">
            {f.answer ? renderRich(f.answer, f.phase === 'streaming') : f.phase === 'waiting' || f.phase === 'streaming' ? <span className="cursor" /> : null}
          </div>
          {f.phase === 'error' ? <p className="ob-sub" role="alert">{f.error}</p> : null}
        </li>
      ))}
    </ol>
  );
}
