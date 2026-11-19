import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Buddy, setBuddyMood } from '../shared/buddy';
import { playTone } from '../shared/tones';
import { askForConsent } from '../shared/consentForm';
import { ThinkingStatus } from '../shared/thinkingStatus';
import { useRailFolded, useTopBar } from '../shared/shell';
import type { ConsentProvider } from '../../core/consent';
import { linesLabel } from '../../core/linesLabel';
import { IC } from './icons';
import { LineIcon } from './lineIcon';

/** The fields of a saved lesson the Quiz reads (learn.tsx's LearningItem has them all). */
export interface QuizLesson {
  id: string; ts: string; title: string; meta: string; outcome: string;
  level: string; lines: number; file?: string; project?: string; code?: string;
}

export type QuizMode = 'quick-check' | 'recall' | 'scenario';

const QUIZ_MODES = [
  { id: 'scenario' as const, label: 'Prove it', detail: 'What breaks if you change this line? The real test of understanding.' },
  { id: 'quick-check' as const, label: 'Quick check', detail: 'One fact from the snippet you already read.' },
  { id: 'recall' as const, label: 'Recall', detail: 'Answer from memory. Peek at the code only if you need it.' },
];

/** One lesson's check is this many questions; "Quiz me on everything" asks one question per lesson, up to MIX_MAX. */
export const CHECK_LENGTH = 3;
export const MIX_MAX = 10;

const LEVEL_NAMES: Record<string, string> = { new: 'New', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' };
const TRY_NAMES = ['First try', 'Second try', 'Third try', 'Fourth try'];
const WRONG_REASON = 'Try another option; the question stays open.';
const LETTERS = 'ABCDEFGH';
const CODE_LIMIT = 2400;

const baseName = (path?: string) => path?.split(/[\\/]/).pop() ?? '';
const levelName = (level: string) => LEVEL_NAMES[level] ?? level;

/** The line a question names ("What breaks if you delete line 4?"), when it names one inside the saved code. */
function namedLine(question: string, code?: string): number | null {
  const match = /\bline (\d+)\b/i.exec(question);
  if (!match || !code) return null;
  const n = Number(match[1]);
  const count = code.slice(0, CODE_LIMIT).split('\n').length;
  return n >= 1 && n <= count ? n : null;
}

function lineText(code: string | undefined, line: number | null): string {
  if (!code || line === null) return '';
  return code.split('\n')[line - 1]?.trim() ?? '';
}

function scoreSentence(first: number, total: number): string {
  if (first === total) return 'Perfect run. You really know this code.';
  if (first >= total * 0.7) return 'Strong. The ones you missed are marked to revisit.';
  return 'Good start. Run it again tomorrow and watch the number climb.';
}

const Tick = () => (
  <svg className="qz-mark qz-mark--right" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="10" />
    <path d="M5.5 10.5l3 3 6-7" />
  </svg>
);

const Cross = () => (
  <svg className="qz-mark qz-mark--wrong" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="9.25" />
    <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" />
  </svg>
);

const Chevron = () => (
  <svg className="qz-chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5l5 5-5 5" /></svg>
);

/** The lesson's code with line numbers; `line` gets the grey band and the 2 px bar, `note` sits at its right. */
function QuizCode({ code, line, note }: { code: string; line: number | null; note?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const mark = markRef.current;
    if (!box || !mark) return;
    box.scrollTop = Math.max(0, mark.offsetTop - (box.clientHeight - mark.offsetHeight) / 2);
  }, [code, line]);
  const lines = code.slice(0, CODE_LIMIT).split('\n');
  return (
    <div className="qz-code" ref={scrollRef}>
      <pre><code>
        {lines.map((text, i) => {
          const on = line === i + 1;
          return (
            <span key={i} className={`qz-code__line${on ? ' is-on' : ''}`} ref={on ? markRef : undefined}>
              <span className="qz-code__n" aria-hidden="true">{i + 1}</span>
              <span className="qz-code__text">{text}{'\n'}</span>
              {on && note ? <span className="qz-code__note">{note}</span> : null}
            </span>
          );
        })}
      </code></pre>
    </div>
  );
}

interface Card { question: string; options: string[] }
interface Answered { lessonId: string; question: string; options: string[]; answerIndex: number; rationale: string; line: number | null; tries: number }
type Step = 'start' | 'question' | 'right' | 'results';

/**
 * A check (Mono, `mono/quiz/README.md`): one 640 px box in the middle, the rail folded, the top bar reading
 * "Quiz › lesson". Start (one lesson: pick the kind, Return starts) → questions (a press selects, Return checks; wrong
 * answers stay open) → each right answer on its own screen → results as tiles. A lesson's check is CHECK_LENGTH
 * questions; `mixIds` runs one question per lesson. Esc is handled by the page (learn.tsx), which calls `onLeave`.
 */
export function QuizCheck({
  lessons,
  first,
  mixIds,
  root,
  onLeave,
  onRefresh,
}: {
  lessons: QuizLesson[];
  first: QuizLesson;
  mixIds: string[] | null;
  root: 'Quiz' | 'Library';
  onLeave: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  useRailFolded(true);
  const [ids, setIds] = useState<string[]>(() => mixIds ?? Array.from({ length: CHECK_LENGTH }, () => first.id));
  const [mix, setMix] = useState(Boolean(mixIds));
  const [step, setStep] = useState<Step>(mixIds ? 'question' : 'start');
  const [mode, setMode] = useState<QuizMode>('scenario');
  const [index, setIndex] = useState(0);
  const [card, setCard] = useState<Card | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [records, setRecords] = useState<Answered[]>([]);
  // "Try the missed one again": the missed questions asked again from what this check already holds (no new card).
  const [replay, setReplay] = useState<Answered[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const requestRef = useRef(false);
  const stepRef = useRef<HTMLDivElement>(null);

  const byId = (id: string | undefined) => lessons.find((item) => item.id === id);
  const lesson = byId(ids[index]) ?? byId(ids[0]) ?? first;
  const modeLabel = QUIZ_MODES.find((item) => item.id === mode)?.label ?? '';
  const where = baseName(lesson.file) || lesson.project || 'Saved lesson';
  const total = ids.length;

  useEffect(() => {
    void window.unvibe.quizStatus().then((s: { remaining: number }) => setLeft(s.remaining));
  }, []);

  const loadQuestion = async (at: number, run: Answered[] | null = replay) => {
    setCard(null); setChosen(null); setWrong([]); setReason(''); setError('');
    if (run) {
      const again = run[at];
      if (again) setCard({ question: again.question, options: again.options });
      return;
    }
    const lessonId = ids[at];
    if (!lessonId || requestRef.current) return;
    requestRef.current = true;
    setBusy(true);
    // Nothing was sent without the first-send agreement: ask after this request settles, then try again.
    let needsConsent: ConsentProvider | null = null;
    try {
      const r: {
        ok: boolean; question?: string; options?: string[]; error?: string; remaining?: number; code?: string; provider?: ConsentProvider;
      } = await window.unvibe.quizStart({ eventId: lessonId, mode });
      if (r.remaining !== undefined) setLeft(r.remaining);
      if (!r.ok && r.code === 'consent' && r.provider) needsConsent = r.provider;
      else if (!r.ok || !r.question || !r.options) setError(r.error ?? 'Could not start quiz.');
      else setCard({ question: r.question, options: r.options });
    } catch {
      setError('Could not start the next question. Try again.');
    } finally {
      requestRef.current = false;
      setBusy(false);
    }
    if (needsConsent && await askForConsent(needsConsent)) void loadQuestion(at, null);
  };

  // A mixed review has no Start screen: its first question loads at once.
  useEffect(() => {
    if (mixIds) void loadQuestion(0, null);
  }, []);

  const begin = () => {
    if (busy) return;
    setRecords([]); setIndex(0); setStep('question');
    void loadQuestion(0);
  };

  const check = async () => {
    if (step !== 'question' || !card || chosen === null || busy || wrong.includes(chosen)) return;
    const choice = chosen;
    const lessonId = ids[index] ?? lesson.id;
    let correct = false;
    let rationale = '';
    let answerIndex = choice;
    if (replay) {
      const again = replay[index];
      if (!again) return;
      correct = choice === again.answerIndex;
      rationale = correct ? again.rationale : WRONG_REASON;
      answerIndex = again.answerIndex;
    } else {
      setBusy(true); setError('');
      let r: { ok: boolean; correct?: boolean; rationale?: string; answerIndex?: number; error?: string };
      try {
        r = await window.unvibe.quizAnswer({ eventId: lessonId, choice });
      } catch {
        r = { ok: false };
      } finally {
        setBusy(false);
      }
      if (!r.ok) { setError(r.error ?? 'Could not grade.'); return; }
      correct = Boolean(r.correct);
      rationale = r.rationale ?? (correct ? 'You got it.' : WRONG_REASON);
      answerIndex = r.answerIndex ?? choice;
      void onRefresh();
    }
    if (!correct) {
      setWrong((prev) => [...prev, choice]);
      setChosen(null);
      setReason(rationale);
      playTone('wrong');
      return;
    }
    setBuddyMood('celebrate');
    setRecords((prev) => [...prev, {
      lessonId, question: card.question, options: card.options, answerIndex, rationale,
      line: namedLine(card.question, byId(lessonId)?.code), tries: wrong.length + 1,
    }]);
    setStep('right');
  };

  const next = () => {
    if (index + 1 < total) {
      setIndex(index + 1);
      setStep('question');
      void loadQuestion(index + 1);
      return;
    }
    const firstTry = records.filter((item) => item.tries === 1).length;
    setBuddyMood(firstTry >= records.length * 0.7 ? 'celebrate' : 'happy');
    setStep('results');
  };

  const missed = records.filter((item) => item.tries > 1);
  const runIds = new Set(ids);
  const nextLesson = lessons.find((item) => !runIds.has(item.id) && item.outcome === 'needs_review')
    ?? lessons.slice(lessons.findIndex((item) => item.id === lesson.id) + 1).find((item) => !runIds.has(item.id))
    ?? lessons.find((item) => !runIds.has(item.id))
    ?? null;

  const tryMissed = () => {
    if (!missed.length) return;
    setReplay(missed);
    setIds(missed.map((item) => item.lessonId));
    setRecords([]); setIndex(0); setStep('question');
    void loadQuestion(0, missed);
  };

  const goNextLesson = () => {
    if (!nextLesson) return;
    setIds(Array.from({ length: CHECK_LENGTH }, () => nextLesson.id));
    setMix(false); setReplay(null); setRecords([]); setIndex(0);
    setCard(null); setChosen(null); setWrong([]); setReason(''); setError('');
    setStep('start');
  };

  // One window listener that always sees this render's state.
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  keyRef.current = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, summary')) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.key === 'Escape') return;
    const enter = event.key === 'Enter';
    if (step === 'start') {
      const pick = /^[1-3]$/.test(event.key) ? QUIZ_MODES[Number(event.key) - 1] : undefined;
      if (pick && !busy) { event.preventDefault(); setMode(pick.id); }
      else if (enter) { event.preventDefault(); begin(); }
      return;
    }
    if (step === 'question') {
      if (!card || busy) return;
      if (enter) { event.preventDefault(); void check(); return; }
      const fromLetter = event.key.length === 1 ? LETTERS.indexOf(event.key.toUpperCase()) : -1;
      const fromNumber = /^[1-8]$/.test(event.key) ? Number(event.key) - 1 : -1;
      const at = fromLetter >= 0 ? fromLetter : fromNumber;
      if (at < 0 || at >= card.options.length || wrong.includes(at)) return;
      event.preventDefault();
      setChosen(at);
      return;
    }
    if (!enter) return;
    event.preventDefault();
    if (step === 'right') next();
    else if (step === 'results') {
      if (nextLesson) goNextLesson();
      else onLeave();
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A new screen takes focus (screen readers hear it); selecting an answer does not move focus.
  const screenKey = `${step}-${index}-${ids[index] ?? ''}`;
  useEffect(() => {
    stepRef.current?.focus({ preventScroll: true });
  }, [screenKey]);

  const crumb = mix ? 'Quiz me on everything' : lesson.title;
  // The bar re-publishes whenever its node changes, and publishing re-renders the page (a new `onLeave` each time):
  // the node reads `onLeave` through a ref so it only changes with what it shows.
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  const topBar = useMemo(() => (
    <div className="qz-bar">
      <button type="button" className="qz-bar__root" onClick={() => leaveRef.current()}>{root}</button>
      <Chevron />
      <span className="qz-bar__lesson">{crumb}</span>
      <span className="qz-bar__gap" />
      {left !== null ? <span className="qz-bar__left">{left} left today</span> : null}
      <button type="button" className="m-btn m-btn--small m-btn--text qz-bar__leave" onClick={() => leaveRef.current()}>
        Leave <span className="m-key" aria-hidden="true">esc</span>
      </button>
    </div>
  ), [root, crumb, left]);
  useTopBar(topBar);

  const progress = (label: string, doneUpTo: number) => (
    <div className="qz-progress">
      <div className="qz-progress__bar" aria-hidden="true">
        {ids.map((_, i) => <i key={i} className={i < doneUpTo ? 'is-done' : i === index ? 'is-now' : ''} />)}
      </div>
      <div className="qz-progress__row">
        <span className="qz-progress__label">{label}</span>
        <span className="qz-progress__meta">{where} · {modeLabel}</span>
      </div>
    </div>
  );

  const fade = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? '' : ' qz-step--fade';
  let screen: ReactNode;

  if (step === 'start') {
    screen = (
      <div className="qz-box qz-start">
        <span className="qz-start__vibe"><Buddy mood="wave" size={64} label="Vibe" /></span>
        <p className="qz-kicker">{levelName(lesson.level)}, {where}</p>
        <h2 className="qz-title">{lesson.title}</h2>
        <p className="qz-lead">One question at a time. Wrong answers stay open so you can keep trying. About 30 seconds each.</p>
        <div className="qz-modes" role="radiogroup" aria-label="Quiz mode">
          {QUIZ_MODES.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              className={`qz-mode${mode === item.id ? ' is-on' : ''}`}
              disabled={busy}
              onClick={() => setMode(item.id)}
            >
              <span className="qz-radio" aria-hidden="true" />
              <span className="qz-mode__text"><strong>{item.label}</strong><span>{item.detail}</span></span>
              <span className="qz-keytile" aria-hidden="true">{i + 1}</span>
            </button>
          ))}
        </div>
        <button type="button" className="m-btn m-btn--filled qz-start__go" disabled={busy} onClick={begin}>
          Start this check <span className="m-key" aria-hidden="true">↵</span>
        </button>
        <p className="qz-hint">Press 1 to 3 to choose, Return to start</p>
      </div>
    );
  } else if (step === 'question') {
    const recall = mode === 'recall' && !replay;
    const line = card ? namedLine(card.question, lesson.code) : null;
    const lastKey = card ? card.options.length : 4;
    screen = (
      <div className="qz-box qz-question">
        {progress(`Question ${index + 1} of ${total}`, index)}
        {!card ? (
          <div className="qz-wait">
            <span className="qz-q__vibe"><Buddy mood={busy ? 'thinking' : 'confused'} size={40} label="Vibe" /></span>
            {busy ? <ThinkingStatus label="Unvibe" /> : null}
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {!busy ? <button type="button" className="m-btn m-btn--outlined" onClick={() => void loadQuestion(index)}>Try again</button> : null}
          </div>
        ) : (
          <>
            <div className="qz-q">
              <span className="qz-q__vibe"><Buddy mood={busy ? 'thinking' : wrong.length && chosen === null ? 'confused' : 'idle'} size={40} follow label="Vibe" /></span>
              <h2 className="qz-q__text">{card.question}</h2>
            </div>
            {lesson.code ? (recall ? (
              <details className="qz-fold">
                <summary>Show the code</summary>
                <QuizCode code={lesson.code} line={line} />
              </details>
            ) : <QuizCode code={lesson.code} line={line} />) : null}
            <div className="qz-options" role="radiogroup" aria-label="Answers">
              {card.options.map((option, i) => {
                const isWrong = wrong.includes(i);
                const isChosen = chosen === i;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={isChosen}
                    className={`qz-option${isChosen ? ' is-chosen' : ''}${isWrong ? ' is-wrong' : ''}`}
                    disabled={busy || isWrong}
                    onClick={() => setChosen(i)}
                  >
                    <span className="qz-keytile" aria-hidden="true">{i + 1}</span>
                    <span className="qz-option__text">{option}</span>
                    {isWrong ? <><Cross /><span className="sr-only">Wrong answer</span></> : null}
                  </button>
                );
              })}
            </div>
            <div className="qz-foot">
              {reason ? (
                <p className="qz-foot__why" role="status"><strong>Not quite.</strong> {reason}</p>
              ) : (
                <p className="qz-hint">{chosen === null ? `Press 1 to ${lastKey}, then Return` : 'Return to check, or press another number'}</p>
              )}
              <button type="button" className="m-btn m-btn--filled" disabled={chosen === null || busy} onClick={() => void check()}>
                Check answer <span className="m-key" aria-hidden="true">↵</span>
              </button>
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </>
        )}
      </div>
    );
  } else if (step === 'right') {
    const done = records[records.length - 1];
    const tries = done?.tries ?? 1;
    const last = index + 1 >= total;
    screen = (
      <div className="qz-box qz-right">
        {progress(`Question ${index + 1} of ${total}, ${(TRY_NAMES[tries - 1] ?? `Try ${tries}`).toLowerCase()}`, index + 1)}
        <span className="qz-right__vibe"><Buddy mood="celebrate" size={64} label="Vibe is celebrating" /></span>
        <p className="qz-kicker qz-kicker--strong">Nice work</p>
        <h2 className="qz-title">You got it.</h2>
        {done?.rationale ? <p className="qz-why">{done.rationale}</p> : null}
        {lesson.code ? <QuizCode code={lesson.code} line={done?.line ?? null} note="the line that matters" /> : null}
        {done ? (
          <div className="qz-option is-right" role="note">
            <span className="qz-keytile" aria-hidden="true">{done.answerIndex + 1}</span>
            <span className="qz-option__text">{done.options[done.answerIndex]}</span>
            <Tick /><span className="sr-only">Right answer</span>
          </div>
        ) : null}
        <button type="button" className="m-btn m-btn--filled qz-right__go" onClick={next}>
          {last ? 'See my score' : 'Next question'} <span className="m-key" aria-hidden="true">↵</span>
        </button>
        <p className="qz-hint">Press Return to continue</p>
      </div>
    );
  } else {
    const firstTry = records.filter((item) => item.tries === 1).length;
    const count = records.length;
    screen = (
      <div className="qz-results">
        <div className="m-grid m-grid--23">
          <section className="m-box qz-solid qz-head">
            <span className="qz-head__vibe"><Buddy mood={firstTry >= count * 0.7 ? 'celebrate' : 'happy'} size={64} label="Vibe" /></span>
            <div>
              <p className="qz-kicker">{mix ? 'Mixed review done' : `${levelName(lesson.level)}, ${lesson.title}`}</p>
              <h2 className="qz-title">{firstTry} of {count} on the first try.</h2>
              <p className="qz-lead">{scoreSentence(firstTry, count)}</p>
            </div>
          </section>
          <div className="m-grid m-grid--half">
            <section className="m-box m-tile qz-solid">
              <span className="m-tile__num">{firstTry} of {count}</span>
              <span className="m-tile__label">First try</span>
              <span className="m-tile__note">questions</span>
            </section>
            <section className="m-box m-tile qz-solid">
              <span className="m-tile__num">{count - firstTry}</span>
              <span className="m-tile__label">To revisit</span>
              <span className="m-tile__note">missed on the first try</span>
            </section>
          </div>
        </div>
        <div className="m-grid m-grid--thirds">
          {records.map((item, i) => {
            const code = lineText(byId(item.lessonId)?.code, item.line);
            return (
              <section key={i} className="m-box qz-solid qz-tile">
                <div className="qz-tile__head">
                  <span className="qz-tile__n">Question {i + 1}</span>
                  <span className="qz-tile__try">
                    {TRY_NAMES[item.tries - 1] ?? `Try ${item.tries}`}
                    {item.tries === 1 ? <Tick /> : <span className="m-chip m-chip--outlined">To revisit</span>}
                  </span>
                </div>
                <p className="qz-tile__q">{item.question}</p>
                <p className="qz-tile__label">Right answer</p>
                <p className="qz-tile__a">{item.options[item.answerIndex]}</p>
                {code ? <p className="qz-tile__code"><span aria-hidden="true">{item.line}</span><code>{code}</code></p> : null}
              </section>
            );
          })}
        </div>
        <section className="m-box qz-solid qz-next">
          {nextLesson ? (
            <div className="qz-next__what">
              <p className="qz-kicker">Next up</p>
              <p><strong>{nextLesson.title}</strong>{[nextLesson.project, baseName(nextLesson.file)].filter(Boolean).length ? <span className="m-muted"> {[nextLesson.project, baseName(nextLesson.file)].filter(Boolean).join(' · ')}</span> : null}</p>
            </div>
          ) : <span className="qz-next__what" />}
          <button type="button" className={`m-btn ${nextLesson ? 'm-btn--text' : 'm-btn--filled'}`} onClick={onLeave}>Back to {root}</button>
          {missed.length ? (
            <button type="button" className="m-btn m-btn--outlined" onClick={tryMissed}>{missed.length === 1 ? 'Try the missed one again' : 'Try the missed ones again'}</button>
          ) : null}
          {nextLesson ? (
            <button type="button" className="m-btn m-btn--filled" onClick={goNextLesson}>
              Next lesson <span className="m-key" aria-hidden="true">↵</span>
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className={`qz${step === 'results' ? ' qz--wide' : ''}`}>
      <div className={`qz-step${fade}`} key={screenKey} ref={stepRef} tabIndex={-1}>
        {screen}
      </div>
    </div>
  );
}

/** The Quiz page (Mono): Vibe by the title, "Quiz me on everything", the lesson to continue, saved lessons. */
export function QuizHome<T extends QuizLesson>({
  catalog,
  continueItem,
  shortcut,
  query,
  onQuery,
  onMix,
  onOpen,
  onReview,
  trash,
}: {
  catalog: T[];
  continueItem: T | null;
  shortcut: string;
  query: string;
  onQuery: (value: string) => void;
  onMix: () => void;
  onOpen: (item: T) => void;
  onReview: () => void;
  trash: (item: T) => ReactNode;
}) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    void window.unvibe.quizStatus().then((s: { remaining: number }) => setLeft(s.remaining));
  }, []);

  // Return starts the lesson to continue (the page's one keyboard action).
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  keyRef.current = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey || !continueItem) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]')) return;
    event.preventDefault();
    onOpen(continueItem);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const needle = query.trim().toLowerCase();
  const rows = catalog.filter((item) => [item.title, item.meta, item.file, item.project].filter(Boolean).join(' ').toLowerCase().includes(needle));
  const mixCount = Math.min(MIX_MAX, catalog.length);

  return (
    <div className="learn-page learn-page--quiz qz-home">
      <section className="m-box qz-home__head">
        <span className="qz-home__vibe"><Buddy mood={catalog.length ? 'idle' : 'sleepy'} size={48} label="Vibe" /></span>
        <div className="qz-home__title">
          <h1>Quick Quiz</h1>
          <p>Pick a saved lesson, choose the challenge, and see what stayed with you.</p>
        </div>
        {catalog.length > 1 ? (
          <div className="qz-home__mix">
            <button type="button" className="m-btn m-btn--filled" onClick={onMix}>Quiz me on everything</button>
            <span>{mixCount} questions{left !== null ? ` · ${left} left today` : ''}</span>
          </div>
        ) : null}
      </section>

      {catalog.length === 0 ? (
        <section className="m-box qz-home__empty">
          <h2>Nothing to check yet.</h2>
          <p>Select code and press {shortcut}. After an explanation finishes, it lands here.</p>
          <button type="button" className="m-btn m-btn--filled" onClick={onReview}>Explain some code</button>
        </section>
      ) : null}

      {continueItem ? (
        <section className="m-box qz-home__continue">
          <div>
            <p className="qz-kicker qz-kicker--strong">Check understanding</p>
            <p className="qz-home__lesson"><strong>{continueItem.title}</strong>{continueItem.file || continueItem.project ? <span>{baseName(continueItem.file) || continueItem.project}</span> : null}</p>
          </div>
          <button type="button" className={`m-btn ${catalog.length > 1 ? 'm-btn--outlined' : 'm-btn--filled'}`} onClick={() => onOpen(continueItem)}>
            Start <span className="m-key" aria-hidden="true">↵</span>
          </button>
        </section>
      ) : null}

      {catalog.length > 0 ? (
        <section className="m-box m-box--flush qz-home__list" aria-labelledby="qz-saved-title">
          <div className="m-box__title">
            <h2 id="qz-saved-title">Saved lessons</h2>
            <span className="m-box__meta">
              <label className="m-search qz-home__search">
                <span className="sr-only">Search your explanations</span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="M13 13l4 4" /></svg>
                <input className="m-input m-input--pill" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search your library" />
              </label>
              <span>{catalog.length} {catalog.length === 1 ? 'lesson' : 'lessons'}</span>
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="m-box__body m-muted" role="status">No lessons match “{query.trim()}”.</p>
          ) : rows.map((item) => (
            <div key={item.id} className="m-row qz-home__row">
              <button type="button" className="qz-home__pick" onClick={() => onOpen(item)}>
                <span className="qz-home__icon"><LineIcon d={IC.quiz} /></span>
                <span className="m-row__main">
                  <span className="m-row__title">{item.title}</span>
                  <span className="m-row__meta">{[item.project, baseName(item.file)].filter(Boolean).join(' · ') || item.meta || linesLabel(item.lines)}</span>
                </span>
                <span className="qz-home__day">{new Date(item.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                <span className="m-link">Check understanding <Chevron /></span>
              </button>
              {trash(item)}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
