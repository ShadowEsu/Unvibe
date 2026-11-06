import type { Ref } from 'react';
import type { QuizMode } from '../../core/protocol';
import { Buddy } from '../shared/buddy';
import { VibeBubble } from '../shared/vibeBubble';

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

/** "Test me · 1 of 3 · Prove it" (SPEC §4): where you are and what kind of question this is. */
export function quizKicker(quiz: Quiz): string {
  const parts = ['Test me'];
  if (quiz.total && quiz.total > 1) parts.push(`${quiz.index ?? 1} of ${quiz.total}`);
  const mode = quiz.mode ? MODE_LABEL[quiz.mode] : undefined;
  if (mode) parts.push(mode);
  return parts.join(' · ');
}

/** What Vibe says about an answer, verbatim from the side panel before the redesign. */
export function quizVerdict(quiz: Quiz): string {
  if (!quiz.correct) return 'Not quite. Saved to revisit.';
  return quiz.hasMissed ? 'Correct. Earlier misses are saved to revisit.' : 'Correct. That one is understood.';
}

/** After the last question, a plain line under Vibe's bubble (Design Q10); nothing before then. */
export function quizEndLine(quiz: Quiz): string | null {
  if ((quiz.index ?? 1) < (quiz.total ?? 3)) return null;
  return quiz.hasMissed ? "That's all three for this code. Missed ones come back in your review queue." : 'All three right.';
}

export function quizHasNext(quiz: Quiz): boolean {
  return (quiz.index ?? 1) < (quiz.total ?? 3);
}

/**
 * Test me in the panel's body (SPEC §4): the question, four options (the right one turns into a lime ✓), and Vibe's
 * verdict in its bubble with the reasoning and, after the last question, the end line under it.
 */
export function QuizCard({ quiz, questionRef, onChoose }: {
  quiz: Quiz;
  questionRef?: Ref<HTMLHeadingElement>;
  onChoose: (index: number) => void;
}) {
  if (quiz.phase === 'loading') {
    return (
      <div className="quiz quiz--wait" role="status">
        <span>Writing a question…</span>
        <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
      </div>
    );
  }
  if (quiz.phase === 'failed') {
    return (
      <div className="quiz" role="alert">
        <div className="quiz__kicker">Test me</div>
        <p className="quiz__why">{quiz.error}</p>
      </div>
    );
  }
  const graded = quiz.phase === 'graded';
  const endLine = graded ? quizEndLine(quiz) : null;
  return (
    <>
      <div className="quiz">
        <div className="quiz__kicker">{quizKicker(quiz)}</div>
        <h2 className="quiz__q" ref={questionRef} tabIndex={-1}>{quiz.question}</h2>
        <div className="quiz__opts">
          {quiz.options?.map((option, i) => {
            const right = graded && i === quiz.answerIndex;
            const state = graded ? (right ? ' right' : i === quiz.choice ? ' wrong' : '') : i === quiz.choice ? ' sel' : '';
            return (
              <button
                key={i}
                type="button"
                className={`opt${state}`}
                aria-pressed={graded ? undefined : i === quiz.choice}
                disabled={quiz.phase !== 'answering'}
                onClick={() => onChoose(i)}
              >
                <em aria-hidden="true">{right ? '✓' : String.fromCharCode(65 + i)}</em>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      </div>
      {graded ? (
        <>
          <div className={`verdict ${quiz.correct ? 'ok' : 'no'}`}>
            {/* The bubble already names Vibe; the art is decoration here. */}
            <span aria-hidden="true"><Buddy mood={quiz.correct ? 'celebrate' : 'confused'} size={44} label="Vibe" /></span>
            <VibeBubble>{quizVerdict(quiz)}</VibeBubble>
          </div>
          {quiz.rationale ? <p className="quiz__why">{quiz.rationale}</p> : null}
          {endLine ? <p className="quiz__end">{endLine}</p> : null}
        </>
      ) : null}
    </>
  );
}

/** The footer while Test me is open: one primary action for where you are, and a quiet way out. */
export function QuizActions({ quiz, onCheck, onAnother, onRetry, onClose }: {
  quiz: Quiz;
  onCheck: () => void;
  onAnother: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (quiz.phase === 'graded') {
    const next = quizHasNext(quiz);
    return (
      <div className="p-actions">
        {next ? <button type="button" className="btn-primary" onClick={onAnother}>Another question</button> : null}
        <button type="button" className={next ? 'btn-quiet' : 'btn-primary'} onClick={onClose}>Hide question</button>
      </div>
    );
  }
  if (quiz.phase === 'failed') {
    return (
      <div className="p-actions">
        <button type="button" className="btn-primary" onClick={onRetry}>Try again</button>
        <button type="button" className="btn-quiet" onClick={onClose}>Hide</button>
      </div>
    );
  }
  return (
    <div className="p-actions">
      {quiz.phase === 'loading' ? null : (
        <button type="button" className="btn-primary" disabled={quiz.choice === undefined || quiz.phase === 'grading'} onClick={onCheck}>
          {quiz.phase === 'grading' ? 'Checking…' : 'Check'}
        </button>
      )}
      <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
    </div>
  );
}
