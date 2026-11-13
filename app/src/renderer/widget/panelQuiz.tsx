import type { Ref } from 'react';
import type { QuizMode } from '../../core/protocol';
import { Buddy } from '../shared/buddy';
import { Icon } from './icons';

export interface Quiz {
  phase: 'loading' | 'answering' | 'grading' | 'graded' | 'failed';
  /** Why a question could not be written (phase 'failed'). */
  error?: string;
  question?: string;
  options?: string[];
  choice?: number;
  correct?: boolean;
  answerIndex?: number;
  rationale?: string;
  index?: number;
  total?: number;
  mode?: QuizMode;
  hasMissed?: boolean;
}

const MODE_LABEL: Partial<Record<QuizMode, string>> = { scenario: 'Prove it', recall: 'Recall' };

/** "Question 1 of 3" (SPEC Test me): where you are. */
export function quizCount(quiz: Quiz): string {
  return `Question ${quiz.index ?? 1} of ${quiz.total ?? 3}`;
}

/** The kind of question and the depth it is at, beside the count ("Prove it · Advanced"). */
export function quizKind(quiz: Quiz, depth?: string): string {
  return [quiz.mode ? MODE_LABEL[quiz.mode] : undefined, depth].filter(Boolean).join(' · ');
}

/** What Vibe says about an answer, verbatim from the side panel before the redesign. */
export function quizVerdict(quiz: Quiz): string {
  if (!quiz.correct) return 'Not quite. Saved to revisit.';
  return quiz.hasMissed ? 'Correct. Earlier misses are saved to revisit.' : 'Correct. That one is understood.';
}

/** After the last question, a plain line under the verdict (Design Q10); nothing before then. */
export function quizEndLine(quiz: Quiz): string | null {
  if ((quiz.index ?? 1) < (quiz.total ?? 3)) return null;
  return quiz.hasMissed ? "That's all three for this code. Missed ones come back in your review queue." : 'All three right.';
}

export function quizHasNext(quiz: Quiz): boolean {
  return (quiz.index ?? 1) < (quiz.total ?? 3);
}

/**
 * The Test me tab, the Quiz at the overlay's size (Mono): a 3-part bar, "Question x of n" and the depth, the question
 * at 17 semibold, four 42 px answer rows with key tiles 1 to 4. A press (or 1 to 4, A to D still accepted) selects;
 * Return or Check grades (`onCheck`, in the footer). Graded: the right row a filled disc with a tick, a wrong pick an
 * outlined disc with a cross, so neither relies on colour. Vibe's verdict line (main's strings) and the reasoning
 * follow. The card fades in once per question.
 */
export function QuizCard({ quiz, depth, pick, questionRef, onPick }: {
  quiz: Quiz;
  depth?: string;
  /** The selected row before it is checked. */
  pick: number | null;
  questionRef?: Ref<HTMLHeadingElement>;
  onPick: (index: number) => void;
}) {
  if (quiz.phase === 'loading') {
    return (
      <div className="ob-quiz ob-quiz--wait" role="status">
        <span>Writing a question…</span>
        <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
      </div>
    );
  }
  if (quiz.phase === 'failed') {
    return (
      <div className="ob-quiz" role="alert">
        <div className="ob-quiz__kicker">Test me</div>
        <p className="ob-quiz__why">{quiz.error}</p>
      </div>
    );
  }
  const graded = quiz.phase === 'graded';
  const endLine = graded ? quizEndLine(quiz) : null;
  const kind = quizKind(quiz, depth);
  const index = quiz.index ?? 1;
  const total = quiz.total ?? 3;
  const selected = quiz.phase === 'answering' ? pick : quiz.choice ?? null;
  return (
    <div className="ob-quiz" key={`${index}:${quiz.question}`}>
      <div className="ob-quiz__bar" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i + 1 < index || (i + 1 === index && graded) ? 'is-done' : i + 1 === index ? 'is-now' : ''} />
        ))}
      </div>
      <div className="ob-quiz__kicker"><span>{quizCount(quiz)}</span>{kind ? <span>{kind}</span> : null}</div>
      <h2 className="ob-quiz__q" ref={questionRef} tabIndex={-1}>{quiz.question}</h2>
      <div className="ob-quiz__opts">
        {quiz.options?.map((option, i) => {
          const picked = i === selected;
          const right = graded && i === quiz.answerIndex;
          const wrong = graded && picked && !right;
          const state = `${picked ? ' is-picked' : ''}${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}${graded && !picked && !right ? ' is-off' : ''}`;
          return (
            <button
              key={i}
              type="button"
              className={`ob-opt${state}`}
              aria-pressed={picked}
              disabled={quiz.phase !== 'answering'}
              onClick={() => onPick(i)}
            >
              <kbd className="ob-opt__key" aria-hidden="true">{i + 1}</kbd>
              <span className="ob-opt__text">{option}</span>
              {right ? <span className="ob-opt__mark ob-opt__mark--right"><Icon name="check" size={12} /><span className="sr-only">Correct answer</span></span> : null}
              {wrong ? <span className="ob-opt__mark ob-opt__mark--wrong"><Icon name="x" size={12} /><span className="sr-only">Your answer, not correct</span></span> : null}
            </button>
          );
        })}
      </div>
      {graded ? (
        <div className={`ob-verdict ${quiz.correct ? 'is-ok' : 'is-no'}`}>
          <span aria-hidden="true"><Buddy mood={quiz.correct ? 'celebrate' : 'confused'} size={28} label="Vibe" /></span>
          <div>
            <p className="ob-verdict__line" role="status">{quizVerdict(quiz)}</p>
            {quiz.rationale ? <p className="ob-quiz__why">{quiz.rationale}</p> : null}
            {endLine ? <p className="ob-quiz__end">{endLine}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Test me footer. Answering: the key hint and the one filled "Check ↵" (off until a row is selected). After an
 * answer: the next question or back to the explanation; after a failure: try again.
 */
export function QuizActions({ quiz, pick, onCheck, onAnother, onRetry, onClose }: {
  quiz: Quiz;
  pick: number | null;
  onCheck: () => void;
  onAnother: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (quiz.phase === 'answering' || quiz.phase === 'grading') {
    const count = quiz.options?.length ?? 4;
    const ready = quiz.phase === 'answering' && pick !== null;
    return (
      <div className="ob-quiz__foot">
        <span className="ob-quiz__hint">{pick === null ? `Press 1 to ${count}, then Return` : 'Return to check'}</span>
        <button type="button" className="ob-btn ob-btn--small" disabled={!ready} onClick={onCheck}>
          Check<kbd className="ob-key" aria-hidden="true">↵</kbd>
        </button>
      </div>
    );
  }
  if (quiz.phase === 'graded') {
    const next = quizHasNext(quiz);
    return (
      <div className="ob-chips">
        {next ? <button type="button" className="ob-btn ob-btn--small" onClick={onAnother}>Another question</button> : null}
        <button type="button" className={next ? 'ob-btn ob-btn--small ghost' : 'ob-btn ob-btn--small'} onClick={onClose}>Hide question</button>
      </div>
    );
  }
  if (quiz.phase === 'failed') {
    return (
      <div className="ob-chips">
        <button type="button" className="ob-btn ob-btn--small" onClick={onRetry}>Try again</button>
        <button type="button" className="ob-btn ob-btn--small ghost" onClick={onClose}>Hide</button>
      </div>
    );
  }
  return null;
}
