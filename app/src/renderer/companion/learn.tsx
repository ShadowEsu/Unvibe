import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RichText } from '../shared/richText';
import { ThinkingStatus } from '../shared/thinkingStatus';
import { Buddy } from '../shared/buddy';
import { deviceName } from '../shared/platform';
import { askForConsent } from '../shared/consentForm';
import type { ConsentProvider } from '../../core/consent';
import { useTopBar } from '../shared/shell';
import { IC } from './icons';
import { LineIcon } from './lineIcon';
import { InkTitle } from './inkTitle';
import { useSettled } from '../shared/useSettled';
import { QuizCheck, QuizHome, MIX_MAX } from './quizCheck';

interface FeedItem { id: string; ts: string; title: string; meta: string; outcome: string }
interface LearningItem extends FeedItem {
  concept?: string; level: string; lines: number;
  file?: string; project?: string; scope?: string; dueLabel?: string;
  language?: string; code?: string; explanation?: string;
  note?: string;
}

const STUDY_LEVELS = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
] as const;

type LessonMode = 'read' | 'restudy' | 'check';

function outcomeName(outcome: string): string {
  return outcome === 'understood' ? 'Understood' : outcome === 'needs_review' ? 'To revisit' : 'Reviewed';
}

/** Library's list / grid choice: a view preference on this computer only (no setting, nothing synced). */
const LIBRARY_VIEW_KEY = 'unvibe.library.view';
type LibraryView = 'grid' | 'list';
function readLibraryView(): LibraryView {
  try { return window.localStorage.getItem(LIBRARY_VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
}

const LIST_ICON = 'M4 6h12 M4 10h12 M4 14h12';
const GRID_ICON = 'M4 4h5v5H4z M11 4h5v5h-5z M4 11h5v5H4z M11 11h5v5h-5z';
const SEARCH_ICON = 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M13.5 13.5 17 17';
const CHEVRON = 'M8 5l5 5-5 5';
const CHECK_ICON = 'M5 10.5l3.2 3.2L15 7';

/** "6 Nov": the day a lesson was saved, on its card and its row. */
function shortDate(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  return when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The first `count` lines of a lesson's saved code, leading blank lines dropped and the common indent removed. */
function codeHead(code: string | undefined, count: number): string {
  if (!code) return '';
  const lines = code.replace(/\s+$/, '').split('\n');
  let start = 0;
  while (start < lines.length && !lines[start].trim()) start++;
  const head = lines.slice(start, start + count).map((line) => line.replace(/\t/g, '  '));
  const indent = Math.min(...head.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length));
  return head.map((line) => line.slice(Number.isFinite(indent) ? indent : 0)).join('\n');
}

/** "sample-app · debounce.js": where a lesson's code came from (the file's name, not its path). */
function lessonWhere(item: LearningItem): string {
  return `${item.project || `This ${deviceName}`} · ${item.file?.split(/[\\/]/).pop() || item.scope || 'Selection'}`;
}

function StatusChip({ outcome }: { outcome: string }) {
  return outcome === 'needs_review'
    ? <span className="m-chip m-chip--outlined">Review</span>
    : <span className="m-chip">Current</span>;
}

/**
 * The lesson's top bar: "Library › lesson" (the root is the way back) and "⌃U Explain" at the right, which the
 * published bar replaces. The node reads `onBack` through a ref so it only changes with what it shows.
 */
function LessonBar({ root, title, shortcut, onBack }: { root: string; title: string; shortcut: string; onBack: () => void }) {
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const node = useMemo(() => (
    <div className="mles-bar">
      <button type="button" className="mles-bar__root" onClick={() => backRef.current()}>{root}</button>
      <LineIcon className="mles-bar__chev" d={CHEVRON} />
      <span className="mles-bar__lesson">{title}</span>
      <span className="mles-bar__gap" />
      <button type="button" className="topbar__explain" onClick={() => window.unvibe.companionReview()}>
        <kbd className="m-key">{shortcut}</kbd><span>Explain</span>
      </button>
    </div>
  ), [root, title, shortcut]);
  useTopBar(node);
  return null;
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

export function Learn({
  history,
  queue,
  shortcut,
  intent = 'learn',
  onReview,
  onRestudy,
  onRefresh,
  initialOpenId,
}: {
  history: LearningItem[];
  queue: LearningItem[];
  shortcut: string;
  intent?: 'learn' | 'history' | 'quiz';
  onReview: () => void;
  onRestudy: (item: LearningItem, level: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  initialOpenId?: string | null;
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
  const [view, setView] = useState<LibraryView>(readLibraryView);
  const chooseView = (next: LibraryView) => {
    setView(next);
    try { window.localStorage.setItem(LIBRARY_VIEW_KEY, next); } catch { /* storage blocked: the choice lasts this visit */ }
  };
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const feedRef = useRef<HTMLDivElement>(null);
  // The list's arrival (app-0151.css §3 row 3) plays once; a filter or search re-render shows rows at once.
  const settled = useSettled();
  const scrollRef = useRef(0);
  const [mode, setMode] = useState<LessonMode>('read');
  const [level, setLevel] = useState('intermediate');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [askError, setAskError] = useState('');
  const [askLeft, setAskLeft] = useState<number | null>(null);
  // "Quiz me on everything": the lessons of one mixed review (one question each, revisit ones first).
  const [mixIds, setMixIds] = useState<string[] | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [noteError, setNoteError] = useState('');
  const forgetLesson = async (id: string) => {
    if (!window.confirm(`Remove this lesson from this ${deviceName}?`)) return;
    const r = await window.unvibe.forgetLearning(id) as { ok?: boolean };
    if (!r?.ok) return;
    if (openId === id) closeLesson();
    void onRefresh();
  };

  const filtered = catalog.filter((item) => {
    const matchesFilter = filter === 'all' || (filter === 'understood' ? item.outcome === 'understood' : item.outcome === 'needs_review');
    const haystack = [item.title, item.meta, item.file, item.project, item.language, item.concept, item.explanation, item.note].filter(Boolean).join(' ').toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  });

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
    setNoteDraft(item.note ?? '');
    setSavedNote(item.note ?? '');
    setNoteStatus('idle');
    setNoteError('');
  };

  const closeLesson = () => {
    setOpenId(null);
    setMode('read');
    setMixIds(null);
  };

  const saveNote = async () => {
    if (!open || noteStatus === 'saving') return;
    setNoteStatus('saving');
    setNoteError('');
    try {
      const result = await window.unvibe.setLearningNote({ id: open.id, note: noteDraft }) as { ok?: boolean; error?: string };
      if (!result?.ok) {
        setNoteStatus('error');
        setNoteError(result?.error ?? 'Could not save this note. Your draft is still here.');
        return;
      }
    } catch {
      setNoteStatus('error');
      setNoteError('Could not save this note. Your draft is still here.');
      return;
    }
    const normalized = noteDraft.trim();
    setSavedNote(normalized);
    setNoteDraft(normalized);
    setNoteStatus('saved');
    void onRefresh();
  };

  useEffect(() => {
    if (!open) return;
    const note = open.note ?? '';
    setNoteDraft(note);
    setSavedNote(note);
    setNoteStatus('idle');
    setNoteError('');
  }, [open?.id]);

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
  }, [open?.id]);

  // The lesson scrolls with the shell's page (its left column is sticky there), so it opens at its top.
  const lessonRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    lessonRef.current?.closest('.page')?.scrollTo(0, 0);
  }, [open?.id]);

  const ask = async () => {
    if (!open) return;
    setAskBusy(true); setAskError(''); setAnswer('');
    const resultAsk = await window.unvibe.studyAsk({ eventId: open.id, question }) as { ok: boolean; answer?: string; error?: string; remaining?: number; code?: string; provider?: ConsentProvider };
    setAskBusy(false);
    if (resultAsk.remaining !== undefined) setAskLeft(resultAsk.remaining);
    if (!resultAsk.ok && resultAsk.code === 'consent' && resultAsk.provider) {
      // Nothing was sent: ask once, then send this question if the person agrees.
      if (await askForConsent(resultAsk.provider)) void ask();
      return;
    }
    if (!resultAsk.ok) { setAskError(resultAsk.error ?? 'Could not ask.'); return; }
    setAnswer(resultAsk.answer ?? '');
    setQuestion('');
    void onRefresh();
  };

  const startMix = () => {
    const revisit = catalog.filter((item) => item.outcome === 'needs_review');
    const rest = catalog.filter((item) => item.outcome !== 'needs_review').sort(() => Math.random() - 0.5);
    const ids = [...revisit, ...rest].slice(0, MIX_MAX).map((item) => item.id);
    const first = catalog.find((item) => item.id === ids[0]);
    if (!first) return;
    openLesson(first, 'check');
    setMixIds(ids);
  };

  if (open) {
    // A check (Mono quiz flow) takes the whole page: quizCheck.tsx; Esc (above) leaves it like any lesson.
    if (mode === 'check') {
      return <QuizCheck lessons={catalog} first={open} mixIds={mixIds} root={intent === 'quiz' ? 'Quiz' : 'Library'} onLeave={closeLesson} onRefresh={onRefresh} />;
    }
    const modes = (
      <div className="m-seg" role="group" aria-label="Lesson mode">
        {([
          ['read', 'Read'],
          ['restudy', 'Restudy'],
          ['check', 'Check'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            className={`m-seg__item${mode === id ? ' is-on' : ''}`}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
    );
    const levelLabel = STUDY_LEVELS.find((l) => l.id === open.level)?.label ?? open.level;
    const fileName = open.file?.split(/[\\/]/).pop();
    // Mono (mono/lesson/README.md): one header box, then two columns 8 px apart. Left (444 px, sticky in the scroll
    // area): Selected code, then My note (Read). Right: Explanation (Read) or the restudy level (Restudy), then Ask.
    // The code's line numbers are CSS counters (not copied with the code); a long line scrolls sideways in its block.
    const codeBox = (
      <section className="m-box m-box--flush mles-codebox" aria-labelledby="mles-code-title">
        <header className="m-box__title">
          <h2 id="mles-code-title">Selected code</h2>
          {fileName ? <span className="m-box__meta">{fileName}</span> : null}
        </header>
        <div className="mles-codebox__body">
          {open.code ? (
            <div className="mles-code">
              <pre><code>{open.code.split('\n').map((line, i) => <span className="mles-code__line" key={i}>{line}{'\n'}</span>)}</code></pre>
            </div>
          ) : (
            <p className="mles-none">
              {mode === 'restudy'
                ? 'No saved code on this item yet. Restudy will try to reopen the file.'
                : 'Code was not saved for this older entry. New reviews keep the snippet here.'}
            </p>
          )}
        </div>
      </section>
    );
    const askBox = (
      <section className="m-box m-box--flush mles-ask" aria-labelledby="mles-ask-title">
        <header className="m-box__title"><h2 id="mles-ask-title">Ask about this lesson</h2></header>
        <div className="mles-ask__body">
          <p className="mles-ask__hint">Short clarifying questions work best.</p>
          <textarea
            className="mles-field mles-ask__field"
            aria-labelledby="mles-ask-title"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="e.g. Why does this return early here?"
            disabled={askBusy || !open.code}
          />
          <div className="mles-ask__actions">
            <button className="m-btn m-btn--outlined" type="button" disabled={askBusy || !question.trim() || !open.code} onClick={() => void ask()}>
              {askBusy ? 'Working' : 'Ask'}
            </button>
          </div>
          {askBusy ? <ThinkingStatus label="Unvibe" /> : null}
          {askError ? <p className="form-error" role="alert">{askError}</p> : null}
          {answer ? <div className="mles-answer"><span className="mles-answer__label">Answer</span><RichText className="mles-rich" text={answer} /></div> : null}
        </div>
      </section>
    );
    return (
      <div className="learn-page mles" key={open.id} ref={lessonRef}>
        <LessonBar root={intent === 'quiz' ? 'Lessons' : 'Library'} title={open.title} shortcut={shortcut} onBack={closeLesson} />
        <section className="m-box mles-head" aria-labelledby="mles-title">
          <h1 className="mles-head__title" id="mles-title"><InkTitle text={open.title} /></h1>
          <div className="mles-head__tools">
            {intent === 'quiz' ? null : modes}
            <TrashBtn label={`Remove ${open.title}`} onClick={() => void forgetLesson(open.id)} />
          </div>
          <p className="mles-head__meta">
            <span className="mles-head__where">
              {[open.file || open.project || open.meta, open.language, levelLabel].filter(Boolean).join(' · ')}
              <span aria-hidden="true"> · </span>
              <time dateTime={open.ts}>{new Date(open.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
            </span>
            <span className="m-chip mles-head__chip">
              {open.outcome === 'understood' ? <LineIcon d={CHECK_ICON} /> : null}
              {outcomeName(open.outcome)}
            </span>
          </p>
          {askLeft !== null ? <span className="mles-head__left">{askLeft} questions left today</span> : null}
        </section>

        {mode === 'read' ? (
          <div className="mles-cols">
            <div className="mles-left mles-left--read">
              {codeBox}
              <section className="m-box m-box--flush mles-note" aria-labelledby="mles-note-title">
                <header className="m-box__title">
                  <h2 id="mles-note-title">My note</h2>
                  <span className="m-box__meta">Stays on this {deviceName}</span>
                </header>
                <div className="mles-note__body">
                  <textarea
                    className="mles-field mles-note__field"
                    aria-labelledby="mles-note-title"
                    value={noteDraft}
                    maxLength={4000}
                    rows={4}
                    placeholder="Add your own explanation, reminder, or question…"
                    onChange={(event) => { setNoteDraft(event.target.value); setNoteStatus('idle'); setNoteError(''); }}
                  />
                  {noteError ? <p className="form-error mles-note__error" role="alert">{noteError}</p> : null}
                  <div className="mles-note__actions">
                    <span className="mles-note__count">{noteDraft.length.toLocaleString()} / 4,000</span>
                    <span className={`mles-note__status${noteStatus === 'error' ? ' is-error' : ''}`} role="status">
                      {noteStatus === 'saving' ? 'Saving…' : noteStatus === 'saved' ? 'Saved locally' : noteStatus === 'error' ? 'Not saved' : ''}
                    </span>
                    <button type="button" className="m-btn m-btn--outlined" disabled={noteStatus === 'saving' || noteDraft.trim() === savedNote} onClick={() => void saveNote()}>
                      {noteStatus === 'saving' ? 'Saving' : 'Save note'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
            <div className="mles-right">
              <section className="m-box m-box--flush mles-explain" aria-labelledby="mles-explain-title">
                <header className="m-box__title"><h2 id="mles-explain-title">Explanation</h2></header>
                <div className="mles-explain__body">
                  {open.explanation ? <RichText className="mles-rich" text={open.explanation} /> : (
                    <p className="mles-none">No explanation text on file yet for this one.</p>
                  )}
                </div>
              </section>
              {askBox}
            </div>
          </div>
        ) : null}

        {mode === 'restudy' ? (
          <div className="mles-cols">
            <div className="mles-left">{codeBox}</div>
            <div className="mles-right">
              <section className="m-box m-box--flush mles-restudy" aria-labelledby="mles-restudy-title">
                <header className="m-box__title"><h2 id="mles-restudy-title">Restudy level</h2></header>
                <div className="mles-restudy__body">
                  <div className="m-seg" role="group" aria-labelledby="mles-restudy-title">
                    {STUDY_LEVELS.map((opt) => (
                      <button key={opt.id} type="button" className={`m-seg__item${level === opt.id ? ' is-on' : ''}`} aria-pressed={level === opt.id} onClick={() => setLevel(opt.id)}>{opt.label}</button>
                    ))}
                  </div>
                  <button className="m-btn m-btn--filled" type="button" onClick={() => void onRestudy(open, level)}>Explain again at this level</button>
                </div>
              </section>
              {askBox}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Quiz's lesson picker (the Quiz slice owns this block).
  if (intent === 'quiz') return (
    <QuizHome
      catalog={catalog}
      continueItem={continueItem}
      shortcut={shortcut}
      query={query}
      onQuery={setQuery}
      onMix={startMix}
      onOpen={(item) => openLesson(item, 'check')}
      onReview={onReview}
      trash={(item) => <TrashBtn label={`Remove ${item.title}`} onClick={() => void forgetLesson(item.id)} />}
    />
  );

  // Library (Mono, grid/README.md "Library"): one toolbar box, then cards three across or one box of rows.
  const others = continueItem ? filtered.filter((item) => item.id !== continueItem.id) : filtered;
  const shownCards = (continueItem ? 1 : 0) + others.length;
  const listTitle = filter === 'understood' ? 'Understood' : filter === 'needs_review' ? 'Revisit' : 'All lessons';
  return (
    <div className="learn-page mlib">
      <section className="m-box mlib-toolbar">
        <div className="mlib-toolbar__text">
          <h1 className="mono-title"><InkTitle text="Learning Library" /></h1>
          <p className="mono-lead">Saved explanations on this {deviceName}, with source and freshness where we have it.</p>
        </div>
        {catalog.length > 0 ? (
          <div className="mlib-toolbar__tools">
            <div className="m-seg" role="group" aria-label="Filter lessons">
              {([
                ['all', 'All', counts.all],
                ['understood', 'Understood', counts.understood],
                ['needs_review', 'Revisit', counts.needs_review],
              ] as const).map(([id, label, n]) => (
                <button key={id} type="button" className={`m-seg__item${filter === id ? ' is-on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label}<span className="mlib-count">{n}</span>
                </button>
              ))}
            </div>
            <label className="m-search mlib-search">
              <LineIcon d={SEARCH_ICON} />
              <span className="sr-only">Search your explanations</span>
              <input className="m-input m-input--pill" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library" />
            </label>
            <div className="m-seg mlib-view" role="group" aria-label="View">
              {([['list', 'List', LIST_ICON], ['grid', 'Grid', GRID_ICON]] as const).map(([id, label, d]) => (
                <button key={id} type="button" className={`m-seg__item${view === id ? ' is-on' : ''}`} aria-pressed={view === id} aria-label={label} title={label} onClick={() => chooseView(id)}>
                  <LineIcon d={d} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {catalog.length === 0 ? (
        <section className="m-box mlib-empty">
          <Buddy mood="sleepy" size={48} />
          <h2>Nothing saved yet.</h2>
          <p>Select code and press {shortcut}. After an explanation finishes, it lands here.</p>
          <button type="button" className="m-btn m-btn--filled" onClick={onReview}>Explain some code</button>
        </section>
      ) : filtered.length === 0 && (view === 'list' || !continueItem) ? (
        <section className="m-box mlib-empty mlib-empty--quiet" role="status">
          {query.trim() ? (
            <>
              <p>No lessons match “{query.trim()}”{filter === 'all' ? '' : ' in this filter'}.</p>
              <button type="button" className="m-btn m-btn--outlined m-btn--small" onClick={() => setQuery('')}>Clear search</button>
            </>
          ) : <p>Nothing in this filter.</p>}
        </section>
      ) : view === 'grid' ? (
        <div className="m-grid m-grid--thirds mlib-cards" ref={feedRef} data-m-settled={settled || undefined}>
          {continueItem ? (
            <article className="m-box mlib-card mlib-card--resume">
              <div className="mlib-card__head">
                <div className="mlib-card__titles">
                  <span className="mlib-card__kicker">Continue where you left off</span>
                  <h2 className="mlib-card__title">{continueItem.title}</h2>
                  <span className="mlib-card__where">{lessonWhere(continueItem)}</span>
                </div>
                <button type="button" className="mlib-card__go" aria-label={`Continue ${continueItem.title}`} onClick={() => openLesson(continueItem, continueItem.outcome === 'needs_review' ? 'restudy' : 'read')}>
                  <LineIcon d={CHEVRON} />
                </button>
              </div>
              {continueItem.code ? <pre className="mlib-code"><code>{codeHead(continueItem.code, 14)}</code></pre> : <div className="mlib-code mlib-code--none" />}
              <footer className="mlib-card__foot">
                <time dateTime={continueItem.ts}>{shortDate(continueItem.ts)}</time>
                <TrashBtn label={`Remove ${continueItem.title}`} onClick={() => void forgetLesson(continueItem.id)} />
              </footer>
            </article>
          ) : null}
          {others.map((item) => (
            <article key={item.id} className="m-box mlib-card">
              <div className="mlib-card__head">
                <div className="mlib-card__titles">
                  <h2 className="mlib-card__title">{item.title}</h2>
                  <span className="mlib-card__where">{lessonWhere(item)}</span>
                </div>
                <StatusChip outcome={item.outcome} />
              </div>
              {item.code ? <pre className="mlib-code"><code>{codeHead(item.code, 14)}</code></pre> : <div className="mlib-code mlib-code--none" />}
              <footer className="mlib-card__foot">
                <time dateTime={item.ts}>{shortDate(item.ts)}</time>
                <TrashBtn label={`Remove ${item.title}`} onClick={() => void forgetLesson(item.id)} />
                <button type="button" className="m-link" aria-label={`Open ${item.title}`} onClick={() => openLesson(item)}>Open<LineIcon d={CHEVRON} /></button>
              </footer>
            </article>
          ))}
          {shownCards < 6 ? (
            <div className="m-box mlib-card mlib-card--next">
              <Buddy mood="idle" size={48} />
              <h2>Explain something new</h2>
              <p>Select code and press {shortcut}. After an explanation finishes, it lands here.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <section className="m-box m-box--flush mlib-list">
          <header className="m-box__title"><h2>{listTitle}</h2><span className="m-box__meta">{filtered.length === 1 ? '1 lesson' : `${filtered.length} lessons`}</span></header>
          <div className="mlib-rows" ref={feedRef} data-m-settled={settled || undefined}>
            {filtered.map((item) => (
              <div key={item.id} className="m-row mlib-row">
                <button type="button" className="mlib-row__open" onClick={() => openLesson(item)}>
                  <span className="mlib-row__icon"><LineIcon d={IC.library} /></span>
                  <span className="m-row__main">
                    <strong className="m-row__title">{item.title}</strong>
                    <span className="m-row__meta">{lessonWhere(item)}</span>
                  </span>
                  <code className="mlib-row__code">{codeHead(item.code, 1)}</code>
                  <time className="mlib-row__date" dateTime={item.ts}>{shortDate(item.ts)}</time>
                  <StatusChip outcome={item.outcome} />
                  <LineIcon className="mlib-row__chev" d={CHEVRON} />
                </button>
                <TrashBtn label={`Remove ${item.title}`} onClick={() => void forgetLesson(item.id)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
