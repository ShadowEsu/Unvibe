import { useEffect, useMemo, useRef, useState } from 'react';
import { RichText } from '../shared/richText';
import { ThinkingStatus } from '../shared/thinkingStatus';

interface FeedItem { id: string; ts: string; title: string; meta: string; outcome: string }
interface LearningItem extends FeedItem {
  concept?: string; level: string; lines: number;
  file?: string; project?: string; scope?: string; dueLabel?: string;
  language?: string; code?: string; explanation?: string;
}

const STUDY_LEVELS = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
] as const;

type LessonMode = 'read' | 'restudy' | 'check';
type QuizMode = 'quick-check' | 'recall' | 'scenario';

const QUIZ_MODES = [
  { id: 'quick-check' as const, label: 'Quick check', detail: 'One fact from the snippet you already read.' },
  { id: 'recall' as const, label: 'Recall', detail: 'Answer from memory. Peek at the code only if you need it.' },
  { id: 'scenario' as const, label: 'Scenario', detail: 'What would break if this code changed.' },
];

function outcomeName(outcome: string): string {
  return outcome === 'understood' ? 'Understood' : outcome === 'needs_review' ? 'To revisit' : 'Reviewed';
}

function dayGroup(iso: string): string {
  const when = new Date(iso);
  const today = new Date();
  const start = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((start(today) - start(when)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return when.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function LessonCode({ code, language, tall = false }: { code: string; language?: string; tall?: boolean }) {
  return (
    <div className={`lesson-code${tall ? ' lesson-code--tall' : ''}`}>
      <div className="lesson-code__bar"><span>{language || 'code'}</span><span>{code.split('\n').length} lines</span></div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function TrashBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="row-trash" aria-label={label} title="Remove" onClick={onClick}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 6h10M8 6V4.5h4V6M7 6l.5 10h5L13 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function LearningEmpty({ title, detail, onReview }: { title: string; detail: string; onReview: () => void }) {
  return (
    <div className="learning-empty">
      <h2>{title}</h2>
      <p>{detail}</p>
      <button className="primary-btn" onClick={onReview}>Explain some code</button>
    </div>
  );
}

export function Learn({
  history,
  queue,
  shortcut,
  intent = 'learn',
  onReview,
  onRestudy,
  onRefresh,
}: {
  history: LearningItem[];
  queue: LearningItem[];
  shortcut: string;
  intent?: 'learn' | 'history' | 'quiz';
  onReview: () => void;
  onRestudy: (item: LearningItem, level: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}) {
  const catalog = useMemo(() => {
    const seen = new Set<string>();
    const list: LearningItem[] = [];
    for (const item of [...history, ...queue]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      list.push(item);
    }
    return list.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  }, [history, queue]);

  const [filter, setFilter] = useState<'all' | 'understood' | 'needs_review'>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const [mode, setMode] = useState<LessonMode>('read');
  const [level, setLevel] = useState('intermediate');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [askError, setAskError] = useState('');
  const [askLeft, setAskLeft] = useState<number | null>(null);
  const [quizMode, setQuizMode] = useState<QuizMode>('quick-check');
  const [card, setCard] = useState<{ question: string; options: string[]; conceptLabel: string; key: number } | null>(null);
  const [result, setResult] = useState<{ correct: boolean; rationale: string; answerIndex?: number } | null>(null);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizLeft, setQuizLeft] = useState<number | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const [cleared, setCleared] = useState(0);
  const letters = 'ABCDEFGH';
  const forgetLesson = async (id: string) => {
    if (!window.confirm('Remove this lesson from this Mac?')) return;
    const r = await window.unvibe.forgetLearning(id) as { ok?: boolean };
    if (!r?.ok) return;
    if (openId === id) closeLesson();
    void onRefresh();
  };

  const filtered = catalog.filter((item) => {
    const matchesFilter = filter === 'all' || (filter === 'understood' ? item.outcome === 'understood' : item.outcome === 'needs_review');
    const haystack = [item.title, item.meta, item.file, item.project, item.language, item.concept, item.explanation].filter(Boolean).join(' ').toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  });

  const groups = useMemo(() => {
    const map = new Map<string, LearningItem[]>();
    for (const item of filtered) {
      const key = dayGroup(item.ts);
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [filtered]);

  const open = catalog.find((item) => item.id === openId) ?? null;
  const continueItem = catalog.find((item) => item.outcome === 'needs_review') ?? catalog[0] ?? null;
  const counts = {
    all: catalog.length,
    understood: catalog.filter((item) => item.outcome === 'understood').length,
    needs_review: catalog.filter((item) => item.outcome === 'needs_review').length,
  };

  const openLesson = (item: LearningItem, nextMode: LessonMode = intent === 'quiz' ? 'check' : 'read') => {
    scrollRef.current = feedRef.current?.scrollTop ?? 0;
    setOpenId(item.id);
    setMode(nextMode);
    setLevel(item.level || 'intermediate');
    setQuestion('');
    setAnswer('');
    setAskError('');
    setCard(null);
    setResult(null);
    setWrongPicks([]);
    setQuizError('');
    setCleared(0);
  };

  const closeLesson = () => {
    setOpenId(null);
    setMode('read');
    setCard(null);
    setResult(null);
    setWrongPicks([]);
    setCleared(0);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea')) return;
      if (openId) {
        event.preventDefault();
        closeLesson();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  useEffect(() => {
    if (openId) return;
    const node = feedRef.current;
    if (node) node.scrollTop = scrollRef.current;
  }, [openId]);

  useEffect(() => {
    if (!open) return;
    void window.unvibe.studyAskStatus().then((s) => setAskLeft((s as { remaining: number }).remaining));
    void window.unvibe.quizStatus().then((s) => setQuizLeft((s as { remaining: number }).remaining));
  }, [open?.id]);

  const ask = async () => {
    if (!open) return;
    setAskBusy(true); setAskError(''); setAnswer('');
    const resultAsk = await window.unvibe.studyAsk({ eventId: open.id, question }) as { ok: boolean; answer?: string; error?: string; remaining?: number };
    setAskBusy(false);
    if (resultAsk.remaining !== undefined) setAskLeft(resultAsk.remaining);
    if (!resultAsk.ok) { setAskError(resultAsk.error ?? 'Could not ask.'); return; }
    setAnswer(resultAsk.answer ?? '');
    setQuestion('');
    void onRefresh();
  };

  const startQuiz = async (item: LearningItem) => {
    setQuizBusy(true); setQuizError(''); setCard(null); setResult(null); setWrongPicks([]);
    const r = await window.unvibe.quizStart({ eventId: item.id, mode: quizMode }) as {
      ok: boolean; question?: string; options?: string[]; conceptLabel?: string; error?: string; remaining?: number;
    };
    setQuizBusy(false);
    if (r.remaining !== undefined) setQuizLeft(r.remaining);
    if (!r.ok || !r.question || !r.options) { setQuizError(r.error ?? 'Could not start quiz.'); return; }
    const nextKey = cardKey + 1;
    setCardKey(nextKey);
    setCard({ question: r.question, options: r.options, conceptLabel: r.conceptLabel ?? item.title, key: nextKey });
  };

  const answerQuiz = async (choice: number) => {
    if (!open || result?.correct || wrongPicks.includes(choice)) return;
    setQuizBusy(true); setQuizError('');
    const r = await window.unvibe.quizAnswer({ eventId: open.id, choice }) as {
      ok: boolean; correct?: boolean; rationale?: string; answerIndex?: number; error?: string;
    };
    setQuizBusy(false);
    if (!r.ok) { setQuizError(r.error ?? 'Could not grade.'); return; }
    if (!r.correct) {
      setWrongPicks((prev) => (prev.includes(choice) ? prev : [...prev, choice]));
      setResult({ correct: false, rationale: r.rationale ?? 'Sorry, wrong. Pick another option.' });
      void onRefresh();
      return;
    }
    setResult({ correct: true, rationale: r.rationale ?? 'You got it.', answerIndex: r.answerIndex ?? choice });
    setCleared((count) => count + 1);
    void onRefresh();
  };

  useEffect(() => {
    if (!open || mode !== 'check') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') return;
      if (!card && !quizBusy && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        void startQuiz(open);
        return;
      }
      if (!card || quizBusy) return;
      if (result?.correct && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        void startQuiz(open);
        return;
      }
      if (result?.correct) return;
      const letter = event.key.toUpperCase();
      const fromLetter = letters.indexOf(letter);
      const fromNumber = /^[1-8]$/.test(event.key) ? Number(event.key) - 1 : -1;
      const index = fromLetter >= 0 ? fromLetter : fromNumber;
      if (index < 0 || index >= card.options.length) return;
      event.preventDefault();
      void answerQuiz(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, card, quizBusy, result, quizMode, wrongPicks]);

  if (open) {
    const survey = mode === 'check';
    const ticks = Math.min(5, cleared);
    return (
      <div className={`learn-page learn-page--lesson${survey ? ' learn-page--survey' : ''}`}>
        <header className="lesson-bar">
          <button type="button" className="lesson-back" onClick={closeLesson}>{intent === 'quiz' ? 'Lessons' : 'Library'}</button>
          <div className="lesson-bar__meta">
            <span>{open.file || open.project || open.meta || 'Saved lesson'}</span>
            {quizLeft !== null && survey ? <span>{quizLeft} left today</span> : null}
            {askLeft !== null && mode === 'restudy' ? <span>{askLeft} questions left today</span> : null}
          </div>
          {intent === 'quiz' ? (
            <span className="survey-cleared">{cleared} cleared this sitting</span>
          ) : (
            <div className="lesson-modes" role="tablist" aria-label="Lesson mode">
              {([
                ['read', 'Read'],
                ['restudy', 'Restudy'],
                ['check', 'Check'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  className={mode === id ? 'on' : ''}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <TrashBtn label={`Remove ${open.title}`} onClick={() => void forgetLesson(open.id)} />
        </header>

        <article className={`lesson-doc${survey ? ' lesson-doc--survey' : ''}`} key={open.id}>
          {!survey ? (
            <div className="lesson-doc__head">
              <div className="learn-reader__chips">
                <span className="pill">{open.level}</span>
                <span className={`pill pill--${open.outcome}`}>{outcomeName(open.outcome)}</span>
                <time dateTime={open.ts}>{new Date(open.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
              </div>
              <h1>{open.title}</h1>
            </div>
          ) : null}

          {mode === 'read' ? (
            <>
              {open.code ? <LessonCode code={open.code} language={open.language} tall /> : (
                <p className="muted">Code was not saved for this older entry. New reviews keep the snippet here.</p>
              )}
              {open.explanation ? (
                <div className="lesson-explain">
                  <span className="learning-kicker">Explanation</span>
                  <RichText className="lesson-explain__body" text={open.explanation} />
                </div>
              ) : (
                <p className="muted">No explanation text on file yet for this one.</p>
              )}
            </>
          ) : null}

          {mode === 'restudy' ? (
            <>
              {open.code ? <LessonCode code={open.code} language={open.language} tall /> : (
                <p className="muted">No saved code on this item yet. Restudy will try to reopen the file.</p>
              )}
              <div className="study-levels">
                <span className="learning-kicker">Restudy level</span>
                <div className="level-row">
                  {STUDY_LEVELS.map((opt) => (
                    <button key={opt.id} type="button" className={level === opt.id ? 'on' : ''} onClick={() => setLevel(opt.id)}>{opt.label}</button>
                  ))}
                </div>
                <button className="primary-btn" type="button" onClick={() => void onRestudy(open, level)}>Explain again at this level</button>
              </div>
              <div className="study-assistant">
                <div className="study-assistant__head">
                  <span className="learning-kicker">Ask about this lesson</span>
                </div>
                <p className="muted">Short clarifying questions work best.</p>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                  placeholder="e.g. Why does this return early here?"
                  disabled={askBusy || !open.code}
                />
                <button className="soft-btn" type="button" disabled={askBusy || !question.trim() || !open.code} onClick={() => void ask()}>
                  {askBusy ? 'Working' : 'Ask'}
                </button>
                {askBusy ? <ThinkingStatus label="Unvibe" /> : null}
                {askError ? <p className="form-error">{askError}</p> : null}
                {answer ? <div className="lesson-explain"><span className="learning-kicker">Answer</span><div className="lesson-explain__body">{answer}</div></div> : null}
              </div>
            </>
          ) : null}

          {survey ? (
            <div className="survey">
              <div className="survey__progress" aria-hidden="true">
                <i style={{ transform: `scaleX(${Math.max(0.08, ticks / 5)})` }} />
              </div>
              <div className="survey__ticks" aria-label={`${cleared} cards cleared this sitting`}>
                {[0, 1, 2, 3, 4].map((index) => (
                  <span key={index} className={index < ticks ? 'on' : ''} />
                ))}
              </div>

              {result?.correct && card ? (
                <div className="survey__end" key={`end-${card.key}`}>
                  <p className="survey__kicker">Nice work</p>
                  <h2>You got it.</h2>
                  <p className="survey__rationale">{result.rationale}</p>
                  <button className="primary-btn" type="button" onClick={() => void startQuiz(open)}>Next question</button>
                  <p className="survey__hint">Press Return to continue</p>
                </div>
              ) : card ? (
                <div className="survey__card" key={card.key}>
                  <p className="survey__kicker">{card.conceptLabel || 'Check'}</p>
                  <h2>{card.question}</h2>
                  {open.code ? (
                    <details className="quiz-code">
                      <summary>Show the code</summary>
                      <LessonCode code={open.code.slice(0, 2400)} language={open.language} />
                    </details>
                  ) : null}
                  <div className="quiz-options" role="list">
                    {card.options.map((opt, idx) => {
                      const isWrong = wrongPicks.includes(idx);
                      const isCorrect = Boolean(result?.correct && result.answerIndex === idx);
                      let cls = '';
                      if (isCorrect) cls = 'correct';
                      else if (isWrong) cls = 'wrong';
                      else if (result?.correct) cls = 'dimmed';
                      return (
                        <button
                          key={`${card.key}-${idx}`}
                          type="button"
                          className={cls}
                          disabled={quizBusy || isWrong || Boolean(result?.correct)}
                          onClick={() => void answerQuiz(idx)}
                        >
                          <span className="quiz-opt-letter" aria-hidden="true">{letters[idx] ?? String(idx + 1)}</span>
                          <span className="quiz-opt-text">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {result && !result.correct ? (
                    <p className="survey__nudge">{result.rationale} Try another option, or press its letter.</p>
                  ) : (
                    <p className="survey__hint">Press A to D, or 1 to 4</p>
                  )}
                  {quizError ? <p className="form-error">{quizError}</p> : null}
                </div>
              ) : (
                <div className="survey__welcome">
                  <p className="survey__kicker">{open.level}, {open.file || 'Saved lesson'}</p>
                  <h2>{open.title}</h2>
                  <p>One question at a time. Wrong answers stay open so you can keep trying. About 30 seconds each.</p>
                  <div className="survey__modes" role="radiogroup" aria-label="Quiz mode">
                    {QUIZ_MODES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={quizMode === item.id}
                        className={quizMode === item.id ? 'on' : ''}
                        disabled={quizBusy}
                        onClick={() => setQuizMode(item.id)}
                      >
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </button>
                    ))}
                  </div>
                  {quizBusy ? <ThinkingStatus label="Unvibe" /> : (
                    <button className="primary-btn" type="button" onClick={() => void startQuiz(open)}>Start this check</button>
                  )}
                  {quizError ? <p className="form-error">{quizError}</p> : null}
                  {!quizBusy ? <p className="survey__hint">Press Return to start</p> : null}
                </div>
              )}
            </div>
          ) : null}
        </article>
      </div>
    );
  }

  return (
    <div className="learn-page">
      <div className="topline learn-topline">
        <div>
          <h1>{intent === 'history' ? 'History' : intent === 'quiz' ? 'Quiz' : 'Learn'}</h1>
          <p className="lead lead--tight">
            {intent === 'history'
              ? 'Every explanation saved on this Mac. Open one to read it again.'
              : intent === 'quiz'
                ? 'Pick a lesson. One question fills the screen, like a short survey. Press a letter to answer.'
                : 'Lessons from reviews on this Mac. Open one to read, restudy, or check yourself.'}
          </p>
        </div>
        {catalog.length > 0 && intent !== 'quiz' ? (
          <div className="learn-filters" role="tablist" aria-label="Filter lessons">
            {([
              ['all', 'All', counts.all],
              ['understood', 'Understood', counts.understood],
              ['needs_review', 'Revisit', counts.needs_review],
            ] as const).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={filter === id ? 'on' : ''}
                onClick={() => setFilter(id)}
              >
                {label}<em>{n}</em>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {catalog.length > 0 ? (
        <div className="history-tools">
          <label className="history-search">
            <span className="sr-only">Search your explanations</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search explanations, files, concepts…" />
          </label>
          {continueItem ? (
            <button type="button" className="history-continue" onClick={() => openLesson(continueItem, intent === 'quiz' ? 'check' : continueItem.outcome === 'needs_review' ? 'restudy' : 'read')}>
              {intent === 'quiz' ? 'Continue this check' : 'Continue where you left off'}
            </button>
          ) : null}
        </div>
      ) : null}

      {catalog.length === 0 ? (
        <LearningEmpty
          title={intent === 'quiz' ? 'Nothing to quiz yet.' : intent === 'history' ? 'No history yet.' : 'Nothing to learn yet.'}
          detail={`Select code and press ${shortcut}. After an explanation finishes, it lands here.`}
          onReview={onReview}
        />
      ) : filtered.length === 0 ? (
        <p className="muted">Nothing in this filter.</p>
      ) : (
        <div className="lib-feed" ref={feedRef}>
          {groups.map(([label, items]) => (
            <section key={label} className="lib-group">
              <h2 className="lib-group__label">{label}</h2>
              <div className="lib-group__rows">
                {items.map((item) => (
                  <div key={item.id} className={intent === 'quiz' ? 'survey-line' : 'lib-line'}>
                    <button
                      type="button"
                      className={intent === 'quiz' ? 'survey-pick' : 'lib-row'}
                      onClick={() => openLesson(item)}
                    >
                      {intent === 'quiz' ? (
                        <>
                          <span className="survey-pick__body">
                            <strong>{item.title}</strong>
                            <span>{item.file || item.project || item.meta || `${item.lines} lines`}, {item.level}</span>
                          </span>
                          <span className="survey-pick__go">Start</span>
                        </>
                      ) : (
                        <>
                          <time dateTime={item.ts}>{new Date(item.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
                          <span className="lib-row__body">
                            <strong>{item.title}</strong>
                            <span>{item.file || item.project || item.meta || `${item.lines} lines`}{item.language ? `, ${item.language}` : ''}, {item.level}</span>
                          </span>
                          <span className={`pill pill--${item.outcome}`}>{outcomeName(item.outcome)}</span>
                        </>
                      )}
                    </button>
                    <TrashBtn label={`Remove ${item.title}`} onClick={() => void forgetLesson(item.id)} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
