import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAgentReview, type AgentReview } from '../../core/agentReview';
import type { ChangeBrief } from '../../core/changeBrief';
import { localDayKey } from '../../core/learning';
import { linesLabel } from '../../core/linesLabel';
import { Buddy, type BuddyMood } from '../shared/buddy';
import { BETA_SURVEY_URL, limitOfferCopy } from '../shared/limitOffer';
import { useRightPane } from '../shared/shell';
import { IC } from './icons';
import { LineIcon } from './lineIcon';
import { CountUp } from '../shared/countUp';
import { InkTitle } from './inkTitle';
import { BriefsProCard, briefsAiLabel } from './briefsPro';

/** What Home reads from a saved lesson. */
export interface HomeLesson { id: string; ts: string; title: string; meta: string; outcome: string; file?: string; project?: string; code?: string }

/** What Home reads from the usage line. */
export interface HomeUsage { used: number; limit: number; remaining: number; resetsAt: string; plan?: string }

/** Recently understood, on Today's right side: four lessons (Mono grid, `mono/grid/README.md`). */
export const RECENT_ROWS = 4;
/** Each lesson there shows the first four lines of its saved code. */
export const PREVIEW_LINES = 4;
/** Up next is one 212 px box: three rows (the brief's row, when there is one, counts as one of them). */
export const UP_NEXT_ROWS = 3;
/** Explained per day on Today: the Island's 14-day strip. */
export const STRIP_DAYS = 14;
/** The local day Vibe last waved on Home. */
export const HOME_WAVE_KEY = 'unvibe.homeWaveDay';
/** How long Home must be on screen before today's wave counts as seen (a Home that flashes past at launch doesn't use it up). */
export const HOME_WAVE_SEEN_MS = 1500;
/** The wave is three of buddy.css's 0.9 s hops; Vibe is at rest after them. */
export const HOME_WAVE_MS = 2700;

export function greetFirst(name?: string): string {
  const clean = (name ?? '').trim();
  if (!clean || clean.toLowerCase() === 'there') return '';
  return clean.split(/\s+/)[0] ?? '';
}

/** Today or Yesterday when it is recent, otherwise a short calendar date. */
export function shortDate(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const today = new Date();
  if (when.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (when.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = when.getFullYear() === today.getFullYear();
  return when.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

function dayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Vibe on Home (SPEC §3): asleep once the explains run out, a wave the first time Home opens on a day, otherwise still. */
export function homeVibeMood(lastWaveDay: string | null, today: string, limitReached: boolean): BuddyMood {
  if (limitReached) return 'sleepy';
  return lastWaveDay === today ? 'idle' : 'wave';
}

function baseName(file: string): string {
  return file.split(/[\\/]/).filter(Boolean).pop() ?? file;
}

/** "project · file", as on the mockup's rows; the lesson's own meta when it has neither. */
export function lessonSource(item: Pick<HomeLesson, 'file' | 'project' | 'meta'>): string {
  return [item.project, item.file ? baseName(item.file) : undefined].filter(Boolean).join(' · ') || item.meta;
}

/** The first `PREVIEW_LINES` lines of a lesson's saved code, from its first line that isn't blank. */
export function codePreview(code: string | undefined): string {
  const lines = (code ?? '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\s+$/, ''));
  const start = lines.findIndex((line) => line.length > 0);
  return start < 0 ? '' : lines.slice(start, start + PREVIEW_LINES).join('\n');
}

/** Recently understood: the latest saved lessons that aren't marked to revisit, with their code. */
export function recentLessons(history: HomeLesson[]): HomeLesson[] {
  return history.filter((item) => item.outcome !== 'needs_review').slice(0, RECENT_ROWS);
}

/** The last `STRIP_DAYS` days of the profile's heat (0 to 5 per day), oldest first; days with no record are 0. */
export function stripDays(heat: number[] | undefined): number[] {
  const last = (heat ?? []).slice(-STRIP_DAYS);
  return [...Array.from({ length: STRIP_DAYS - last.length }, () => 0), ...last];
}

export type LearningStepId = '01' | '02' | '03' | '04' | '05';
export interface LearningStep { id: LearningStepId; title: string; copy: string; icon: string; done: boolean }

/** Main's five learning steps, word for word (Design: Up next is these, in the glass row style). Quiz and Ask are
 *  never marked done, as on main. "Read the change brief" is done once anything is saved: main's rule (its feed was
 *  the saved lessons). */
export function learningSteps(input: { shortcut: string; reviews: number; understood: number; saved: number }): LearningStep[] {
  return [
    { id: '01', title: 'Review a change', copy: `Select code and press ${input.shortcut}.`, icon: IC.code, done: input.reviews > 0 },
    { id: '02', title: 'Save the lesson', copy: 'Mark the explanation understood.', icon: IC.study, done: input.understood > 0 },
    { id: '03', title: 'Take a quick quiz', copy: 'Check whether the idea stuck.', icon: IC.quiz, done: false },
    { id: '04', title: 'Ask one more thing', copy: 'Follow the question while it is fresh.', icon: IC.chat, done: false },
    { id: '05', title: 'Read the change brief', copy: 'See the story before you commit.', icon: IC.briefings, done: input.saved > 0 },
  ];
}

/** What the number tiles count, from the learning profile on this computer (the same numbers as Momentum). */
export interface HomeStats { reviews: number; linesReviewed: number; linesUnderstood: number }

/** The profile numbers Today reads itself (`learning:profile`, as Momentum does): to revisit, and the daily heat. */
interface HomeProfile { needsReview: number; heat: number[] }

/** A saved working-tree brief (`brief:last`): what Briefs last built for the current project. */
interface SavedBrief { brief: ChangeBrief; repoLabel: string }

/** The Briefs page's sentence under its headline. */
const SIZE_LABEL: Record<AgentReview['size'], string> = { small: 'Small change', medium: 'Medium change', large: 'Big change' };

/** The free plan's one name, as on the rail's usage card. */
function planLine(plan: string | undefined): string {
  if (plan === 'trial') return 'Free on this computer';
  if (plan === 'pro') return 'Pro plan';
  if (plan === 'teams') return 'Teams plan';
  if (plan === 'full') return 'Full access plan';
  return 'Free plan';
}

function Chevron() {
  return <svg className="m-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" /></svg>;
}

function FileGlyph() {
  return <svg className="today-brief__glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.75h5.5L12.25 4.5v9.75H4z M6.25 7h3.5 M6.25 9.5h3.5 M6.25 12h2" /></svg>;
}

/** One number tile: the number at 28 px, its label, a note (Mono "Organised containers"). */
function Tile({ value, suffix = '', label, note }: { value: number | null; suffix?: string; label: string; note: string }) {
  return (
    <article className="m-box m-tile">
      <span className="m-tile__num">{value === null ? '–' : <><CountUp value={value} />{suffix}</>}</span>
      <span className="m-tile__label">{label}</span>
      {note ? <span className="m-tile__note">{note}</span> : null}
    </article>
  );
}

/** Today's right side: Recently understood, each lesson with the first lines of its saved code. */
function RecentPane({ lessons, onLibrary }: { lessons: HomeLesson[]; onLibrary: () => void }) {
  return (
    <section className="m-box m-box--flush today-recent" aria-labelledby="home-recent">
      <header className="m-box__title">
        <h2 id="home-recent">Recently understood</h2>
        {lessons.length ? <button type="button" className="m-link" onClick={onLibrary}>See all<Chevron /></button> : null}
      </header>
      {lessons.length ? (
        <ul className="today-recent__list">
          {lessons.map((lesson) => {
            const preview = codePreview(lesson.code);
            return (
              <li key={lesson.id}>
                <button type="button" className="today-recent__item" onClick={onLibrary}>
                  <span className="today-recent__title">{lesson.title}</span>
                  <span className="today-recent__meta">
                    <span className="today-recent__source">{lessonSource(lesson)}</span>
                    <time dateTime={lesson.ts}>{shortDate(lesson.ts)}</time>
                  </span>
                  {preview ? <code className="today-recent__code">{preview}</code> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="today-recent__empty">
          <Buddy mood="sleepy" size={40} label="Vibe" />
          <p>Nothing yet. Your first explanation lands here!</p>
        </div>
      )}
    </section>
  );
}

export interface HomeProps {
  /** The shortcut as separate keys (⌃ U on a Mac; Ctrl Alt U on Windows). */
  shortcutKeys: string[];
  /** The shortcut as one label, for Vibe's note. */
  shortcut: string;
  userName?: string;
  reviews: number;
  /** Lessons marked understood (the profile's count): "Save the lesson" is then done. */
  understood: number;
  stats: HomeStats;
  history: HomeLesson[];
  usage: HomeUsage | null;
  onPlan: () => void;
  onLibrary: () => void;
  onBriefs: () => void;
  onQuiz: () => void;
  onAsk: () => void;
}

/** Today as a grid (Design's Mono, `mono/grid/README.md` "Today as a grid"): greeting with Vibe beside the 14-day
 *  strip; Explain as three steps; Up next beside four number tiles; the saved brief. Recently understood is the right
 *  side. Today runs no git: the brief is the one Briefs last built for this project (`brief:last`) or its empty state. */
export function Home({ shortcutKeys, shortcut, userName, reviews, understood, stats, history, usage, onPlan, onLibrary, onBriefs, onQuiz, onAsk }: HomeProps) {
  const [saved, setSaved] = useState<SavedBrief | null>(null);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [proOpen, setProOpen] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefPro, setBriefPro] = useState(false);
  const [briefError, setBriefError] = useState('');
  const explainDisabled = !!usage && usage.remaining <= 0;
  // Read once when Home opens; today is recorded once Home has been on screen a moment, so Vibe waves on the first real
  // visit of a day only.
  const [wave] = useState(() => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(HOME_WAVE_KEY);
    } catch {
      // Storage unavailable: wave, as on a new day.
    }
    return { last, day: localDayKey(new Date()) };
  });
  const homeMood = homeVibeMood(wave.last, wave.day, explainDisabled);
  // Mono: the daily hello is the wave with its three hops (mono/vibe/README.md), then Vibe rests.
  const [waving, setWaving] = useState(homeMood === 'wave');
  useEffect(() => {
    if (!waving) return undefined;
    const timer = window.setTimeout(() => setWaving(false), HOME_WAVE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mood: BuddyMood = homeMood === 'wave' ? (waving ? 'wave' : 'idle') : homeMood;
  useEffect(() => {
    if (wave.last === wave.day) return undefined;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(HOME_WAVE_KEY, wave.day); } catch { /* Storage unavailable: nothing to record. */ }
    }, HOME_WAVE_SEEN_MS);
    return () => window.clearTimeout(timer);
  }, [wave]);
  useEffect(() => {
    // The brief the user last built in Briefs, for the current project; opening Today never reads the repository (F-P1).
    void window.unvibe.lastChangeBrief().then((result) => {
      const next = result as { ok?: boolean; brief?: ChangeBrief; repoLabel?: string } | null;
      if (next?.ok && next.brief && !next.brief.empty) setSaved({ brief: next.brief, repoLabel: next.repoLabel ?? '' });
    });
    void window.unvibe.billingStatus().then((status) => setProOpen(status.paymentsOpen));
  }, []);
  // To revisit and the 14 days come from the same profile as Momentum and the Island; read again whenever the
  // companion's lessons change (it refreshes them with the profile).
  useEffect(() => {
    void (window.unvibe.profile() as Promise<HomeProfile | null>).then((next) => {
      if (next) setProfile({ needsReview: next.needsReview ?? 0, heat: next.heat ?? [] });
    }, () => undefined);
  }, [history]);

  const first = greetFirst(userName);
  const limitOffer = usage && explainDisabled ? limitOfferCopy(usage.plan, usage, proOpen) : null;
  const brief = saved?.brief ?? null;
  const review = useMemo(() => (brief ? buildAgentReview(brief) : null), [brief]);
  const steps = learningSteps({ shortcut, reviews, understood, saved: history.length });
  const stepsDone = steps.filter((step) => step.done).length;
  const upNext = steps.filter((step) => !step.done).slice(0, brief ? UP_NEXT_ROWS - 1 : UP_NEXT_ROWS);
  const runStep: Record<LearningStepId, () => void> = {
    '01': () => window.unvibe.companionReview(), '02': onLibrary, '03': onQuiz, '04': onAsk, '05': onBriefs,
  };
  // Vibe's notes in sentence case (Design's copy, S7): no "this month" at the limit, since the paused card under it
  // says when they refill.
  const note = explainDisabled ? 'You\'re out of free explanations for now.'
    : brief ? 'You changed some code, want the story?'
      : reviews === 0 ? `Select any code and press ${shortcut}. I'll explain it.`
        : 'Ready when you are.';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  const strip = stripDays(profile?.heat);
  const activeDays = strip.filter((level) => level > 0).length;
  const coverage = stats.linesReviewed > 0 ? Math.round((stats.linesUnderstood / stats.linesReviewed) * 100) : null;
  const needsReview = profile?.needsReview ?? null;

  // The right side: published to the shell while Today is mounted. The companion passes a new onLibrary on every
  // render, so the pane calls it through a ref and only changes when the lessons do.
  const libraryRef = useRef(onLibrary);
  libraryRef.current = onLibrary;
  const lessons = useMemo(() => recentLessons(history), [history]);
  const pane = useMemo(() => <RecentPane lessons={lessons} onLibrary={() => libraryRef.current()} />, [lessons]);
  useRightPane(pane);

  const explainChange = async () => {
    setBriefBusy(true);
    setBriefPro(false);
    setBriefError('');
    try {
      const result = await window.unvibe.explainDiff({ brief: true, scope: 'working' }) as { ok?: boolean; cancelled?: boolean; error?: string; proRequired?: boolean };
      if (result?.proRequired) setBriefPro(true);
      else if (!result?.ok && !result?.cancelled) setBriefError(result?.error ?? 'Could not start that review.');
    } catch {
      setBriefError('Unvibe could not complete this request. Try again.');
    } finally {
      setBriefBusy(false);
    }
  };

  return (
    <div className="today">
      <div className="m-grid m-grid--23 today-row today-row--a">
        <header className="m-box today-hello">
          <Buddy mood={mood} size={56} label="Vibe" />
          <div className="today-hello__copy">
            <h1><InkTitle text={first ? `${dayGreeting()}, ${first}.` : `${dayGreeting()}.`} /></h1>
            <p className="today-hello__note">{note}</p>
          </div>
          <time className="today-hello__date" dateTime={wave.day}>{today}</time>
        </header>
        <section className="m-box today-strip" aria-labelledby="home-strip">
          <header className="today-strip__head">
            <h2 id="home-strip">Explained per day</h2>
            <span className="m-muted">14 days</span>
          </header>
          <div className="today-strip__cells" role="img" aria-label="Activity over the last 14 days">
            {strip.map((level, index) => <i key={index} data-level={level} />)}
          </div>
          <p className="today-strip__count"><b>{activeDays} of 14</b> <span className="m-muted">days</span></p>
        </section>
      </div>

      {limitOffer ? (
        // While the limit is reached, its banner takes the Explain box's place, and its action is the one primary.
        <div className="m-box limit-banner today-limit" role="status">
          <div className="today-limit__text">
            <strong>{limitOffer.title}</strong>
            <p>{limitOffer.body}</p>
          </div>
          <div className="limit-banner__actions">
            {limitOffer.primaryKind === 'survey' ? (
              <button type="button" className="m-btn m-btn--filled primary-btn" onClick={() => void window.unvibe.openUrl(BETA_SURVEY_URL)}>
                {limitOffer.primary}
              </button>
            ) : (
              <button type="button" className="m-btn m-btn--filled primary-btn" onClick={onPlan}>{limitOffer.primary}</button>
            )}
            {limitOffer.showPlan && limitOffer.primaryKind === 'survey' ? (
              <button type="button" className="m-btn m-btn--outlined" onClick={onPlan}>{proOpen ? 'Buy a subscription' : 'Pro opens soon'}</button>
            ) : null}
          </div>
        </div>
      ) : (
        <button type="button" className="m-box today-explain" onClick={() => window.unvibe.companionReview()}>
          <span className="today-explain__text">
            <b>Explain any code, right where it is</b>
            <small>Select code in any app. Vibe pops up beside it.</small>
          </span>
          <span className="today-steps">
            <span className="today-step">
              <span className="today-step__art today-step__select" aria-hidden="true"><i /><i /><i /></span>
              <span className="today-step__label">Select code</span>
            </span>
            <span className="today-step__arrow" aria-hidden="true">→</span>
            <span className="today-step">
              <span className="today-step__art today-step__keys">{shortcutKeys.map((key, index) => <kbd key={`${index}:${key}`}>{key}</kbd>)}</span>
              <span className="today-step__label">Press the keys</span>
            </span>
            <span className="today-step__arrow" aria-hidden="true">→</span>
            <span className="today-step">
              <span className="today-step__art"><Buddy mood="idle" size={28} label="Vibe" /></span>
              <span className="today-step__label">Vibe explains</span>
            </span>
          </span>
        </button>
      )}

      <div className="m-grid m-grid--half today-row today-row--c">
        <section className="m-box m-box--flush today-next" aria-labelledby="home-next">
          <header className="m-box__title">
            <h2 id="home-next">Up next</h2>
            <span className="m-box__meta"><span><CountUp value={stepsDone} /> of {steps.length} done</span></span>
          </header>
          <ol className="today-next__rows">
            {/* The saved brief leads the list when there is one (Design S-1 whole-app S4). */}
            {brief ? (
              <li key="brief"><button type="button" className="m-row today-next__row" onClick={onBriefs}>
                <LineIcon className="today-next__icon" d={IC.briefings} />
                <span className="m-row__main">
                  <span className="m-row__title">Review what changed</span>
                  <span className="m-row__meta">{`${brief.filesChanged} file${brief.filesChanged === 1 ? '' : 's'} in the working tree`}</span>
                </span>
                <span className="m-row__end"><Chevron /></span>
              </button></li>
            ) : null}
            {upNext.map((step) => (
              <li key={step.id}><button type="button" className="m-row today-next__row" onClick={runStep[step.id]}>
                <LineIcon className="today-next__icon" d={step.icon} />
                <span className="m-row__main">
                  <span className="m-row__title">{step.title}</span>
                  <span className="m-row__meta">{step.copy}</span>
                </span>
                <span className="m-row__end"><Chevron /></span>
              </button></li>
            ))}
          </ol>
        </section>
        <div className="m-grid m-grid--half today-tiles" role="group" aria-label="Learning overview">
          <Tile
            value={coverage}
            suffix="%"
            label="Understood"
            note={coverage !== null ? `${stats.linesUnderstood} of ${linesLabel(stats.linesReviewed)}` : 'Not enough data yet.'}
          />
          <Tile
            value={stats.reviews}
            label="Explanations saved"
            note={needsReview !== null ? `${needsReview} still to revisit` : ''}
          />
          <Tile
            value={needsReview}
            label="To revisit"
            note={needsReview ? 'Saved to check again' : 'Not enough data yet.'}
          />
          <Tile
            value={usage ? usage.remaining : null}
            label="Explanations left"
            note={usage ? planLine(usage.plan) : ''}
          />
        </div>
      </div>

      <section className="m-box m-box--flush today-brief" aria-labelledby="home-brief">
        <header className="m-box__title">
          <h2 id="home-brief">Brief</h2>
          {brief ? <span className="m-chip">Working tree</span> : null}
          <button type="button" className="m-link today-brief__open" onClick={onBriefs}>Open<Chevron /></button>
        </header>
        {brief && review ? (
          <div className="m-box__body today-brief__body">
            <div className="today-brief__lead">
              <p className="today-brief__headline">{review.headline}</p>
              <p className="today-brief__sub">{SIZE_LABEL[review.size]}{brief.repo ? ` in ${baseName(brief.repo)}` : ''}. Here is what deserves your eyes first.</p>
              {briefPro ? <BriefsProCard proOpen={proOpen} onPlan={onPlan} /> : (
                <button
                  type="button"
                  className="m-btn m-btn--outlined"
                  disabled={briefBusy}
                  onClick={() => void explainChange()}
                >
                  {briefsAiLabel('Explain the change', usage?.plan ?? null)}
                </button>
              )}
              {briefError ? <p className="today-brief__error" role="alert">{briefError}</p> : null}
            </div>
            <ul className="today-brief__files">
              {review.whatMatters.slice(0, 3).map((file) => (
                <li key={file.path}>
                  <FileGlyph />
                  <code>{file.path}</code>
                  <span className="today-brief__lines">+{file.insertions} / -{file.deletions}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="m-box__body today-brief__empty">
            <p>No brief yet. Build one in Briefs to see what changed before you commit.</p>
          </div>
        )}
      </section>
    </div>
  );
}
