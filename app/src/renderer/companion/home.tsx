import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeBrief } from '../../core/changeBrief';
import { localDayKey } from '../../core/learning';
import type { KnowledgeObject } from '../../core/knowledge';
import { Buddy, REACTION_HOLD_MS, type BuddyMood } from '../shared/buddy';
import { BETA_SURVEY_URL, limitOfferCopy } from '../shared/limitOffer';
import { IC } from './icons';
import { LineIcon } from './lineIcon';
import { InkTitle } from './inkTitle';

/** The daily goal from `learning:today`, derived from saved lessons on this computer. */
export interface TodayGoal { explained: boolean; answered: boolean }

/** What Home reads from a saved lesson. */
export interface HomeLesson { id: string; ts: string; title: string; meta: string; outcome: string; file?: string; project?: string }

/** What Home reads from the usage line. */
export interface HomeUsage { used: number; limit: number; remaining: number; resetsAt: string; plan?: string }

/** Recently understood keeps to five rows (Design's glass Today, c-today; main showed five too). */
export const HOME_ROWS = 5;
/** Up next shows at most three steps that aren't done. */
export const UP_NEXT_ROWS = 3;
/** The local day Vibe last waved on Home. */
export const HOME_WAVE_KEY = 'unvibe.homeWaveDay';
/** How long Home must be on screen before today's wave counts as seen (a Home that flashes past at launch doesn't use it up). */
export const HOME_WAVE_SEEN_MS = 1500;

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

function freshnessLabel(status: KnowledgeObject['freshnessStatus']): { text: string; tone: 'current' | 'review' | 'stale' } {
  if (status === 'CURRENT') return { text: 'Current', tone: 'current' };
  if (status === 'MAY_BE_STALE') return { text: 'Review', tone: 'review' };
  return { text: 'Stale', tone: 'stale' };
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

interface HomeRow { id: string; title: string; source: string; ts: string; pill: string; tone: 'understood' | 'review' }

/** Recently understood lessons, with at most one that needs a look again, three rows in all. */
export function homeRows(knowledge: KnowledgeObject[], history: HomeLesson[]): HomeRow[] {
  const current = knowledge.filter((item) => item.freshnessStatus === 'CURRENT');
  // Until the knowledge index has entries, show the latest saved lessons instead.
  const saved: HomeRow[] = current.length
    ? current.map((item) => ({ id: item.id, title: item.title, source: item.file ? baseName(item.file) : item.repositoryId || item.sourceType, ts: item.updatedAt, pill: shortDate(item.updatedAt), tone: 'understood' }))
    : history.filter((item) => item.outcome !== 'needs_review').map((item) => ({ id: item.id, title: item.title, source: lessonSource(item), ts: item.ts, pill: shortDate(item.ts), tone: 'understood' }));
  if (!saved.length) return [];
  const review: HomeRow[] = knowledge.filter((item) => item.freshnessStatus !== 'CURRENT').slice(0, 1).map((item) => ({
    id: item.id, title: item.title, source: item.file ? baseName(item.file) : item.repositoryId || item.sourceType, ts: item.updatedAt, pill: freshnessLabel(item.freshnessStatus).text, tone: 'review',
  }));
  return [...saved.slice(0, HOME_ROWS - review.length), ...review];
}

/** A check that turns done while Home is showing pops (app-0151.css goalCheckIn); one already done when Home opens
 *  doesn't move. A layout effect, so the pop's first frame is the first one painted. `is-new` stays on afterwards:
 *  its animations have ended, and Home opening again starts without it (Motion, app-0151 moment 5). */
function GoalCheck({ done }: { done: boolean }) {
  const was = useRef(done);
  const [fresh, setFresh] = useState(false);
  useLayoutEffect(() => {
    if (done && !was.current) setFresh(true);
    was.current = done;
  }, [done]);
  return (
    <span className={`home-goal__check${done ? ' is-done' : ''}${done && fresh ? ' is-new' : ''}`} role="img" aria-label={done ? 'Done' : 'Not done yet'}>
      {done ? <span className="home-goal__tick" aria-hidden="true">✓</span> : null}
    </span>
  );
}

/** Today's two steps on one quiet line. No count of days and no celebration. */
function TodayGoalLine({ goal }: { goal: TodayGoal }) {
  return (
    <div className="home-goal" role="group" aria-label="Today's goal">
      <span className="home-goal__label">Today</span>
      <span><GoalCheck done={goal.explained} /> explain 1 piece of code</span>
      <span><GoalCheck done={goal.answered} /> answer 1 question</span>
    </div>
  );
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

export interface HomeProps {
  /** The shortcut as separate keys (⌃ U on a Mac; Ctrl Alt U on Windows). */
  shortcutKeys: string[];
  /** The shortcut as one label, for Vibe's note. */
  shortcut: string;
  userName?: string;
  reviews: number;
  /** Lessons marked understood (the profile's count): "Save the lesson" is then done. */
  understood: number;
  today: TodayGoal | null;
  history: HomeLesson[];
  usage: HomeUsage | null;
  onPlan: () => void;
  onLibrary: () => void;
  onBriefs: () => void;
  onQuiz: () => void;
  onAsk: () => void;
}

/** Today (Design's glass c-today): Vibe and the greeting, one action card, the daily goal, then Up next (main's learning
 *  steps, while any are left) beside Recently understood. */
export function Home({ shortcutKeys, shortcut, userName, reviews, understood, today, history, usage, onPlan, onLibrary, onBriefs, onQuiz, onAsk }: HomeProps) {
  const [brief, setBrief] = useState<ChangeBrief | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeObject[]>([]);
  const [proOpen, setProOpen] = useState(false);
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
  // The daily hello is a reaction (Design's 0.1.51 motion rulings; Motion, app-0151 moment 5): the eyes cross-fade to
  // the wave face for REACTION_HOLD_MS with a still body, then back to idle. `react` changing after mount is what makes
  // Buddy treat it as a reaction (`.buddy--react` stills the wave's hops); it then stays 1. Once per Home open, as the
  // wave day is read once. Steps, a frame apart: idle is painted (opened by a click, React runs this effect before the
  // first paint, and the cross-fade would have nothing to fade from); `react` turns on while Vibe is still idle, so
  // `.buddy--react` is in place before the wave and its hop never starts; then the wave.
  const [hello, setHello] = useState<'not-yet' | 'primed' | 'waving' | 'done'>('not-yet');
  useEffect(() => {
    if (homeMood !== 'wave') return undefined;
    let t = 0;
    let frame = requestAnimationFrame(() => {
      setHello('primed');
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          setHello('waving');
          t = window.setTimeout(() => setHello('done'), REACTION_HOLD_MS);
        });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mood = homeMood === 'wave' ? (hello === 'waving' ? 'wave' : 'idle') : homeMood;
  useEffect(() => {
    if (wave.last === wave.day) return undefined;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(HOME_WAVE_KEY, wave.day); } catch { /* Storage unavailable: nothing to record. */ }
    }, HOME_WAVE_SEEN_MS);
    return () => window.clearTimeout(timer);
  }, [wave]);
  useEffect(() => {
    void window.unvibe.buildChangeBrief({ scope: 'working' }).then((result) => {
      const next = result as { ok?: boolean; brief?: ChangeBrief };
      if (next?.ok && next.brief && !next.brief.empty) setBrief(next.brief);
    });
    void window.unvibe.listKnowledge().then((result) => {
      const next = result as { ok?: boolean; items?: KnowledgeObject[] };
      if (next?.ok) setKnowledge(next.items ?? []);
    });
    void window.unvibe.billingStatus().then((status) => setProOpen(status.paymentsOpen));
  }, []);
  const first = greetFirst(userName);
  const limitOffer = usage && explainDisabled ? limitOfferCopy(usage.plan, usage, proOpen) : null;
  const rows = homeRows(knowledge, history);
  const steps = learningSteps({ shortcut, reviews, understood, saved: history.length });
  const stepsDone = steps.filter((step) => step.done).length;
  const upNext = steps.filter((step) => !step.done).slice(0, UP_NEXT_ROWS);
  const runStep: Record<LearningStepId, () => void> = {
    '01': () => window.unvibe.companionReview(), '02': onLibrary, '03': onQuiz, '04': onAsk, '05': onBriefs,
  };
  // Vibe's notes in sentence case (Design's copy, S7): no "this month" at the limit, since the paused card under it
  // says when they refill.
  const note = explainDisabled ? 'You\'re out of free explanations for now.'
    : brief ? 'You changed some code, want the story?'
      : reviews === 0 ? `Select any code and press ${shortcut}. I'll explain it.`
        : 'Ready when you are.';
  return (
    <div className="home">
      <header className="home-hero">
        <Buddy mood={mood} react={hello === 'not-yet' ? 0 : 1} size={64} label="Vibe" />
        <div className="home-hero__copy">
          <h1><InkTitle text={`${dayGreeting()}${first ? `, ${first}.` : '.'}`} /></h1>
          <p className="home-hero__note">{note}</p>
        </div>
      </header>
      {limitOffer ? (
        // While the limit is reached, its banner takes the action card's place, and its action is the one primary.
        <div className="limit-banner home-card" role="status">
          <div className="home-card__text">
            <strong>{limitOffer.title}</strong>
            <p>{limitOffer.body}</p>
          </div>
          <div className="limit-banner__actions">
            {limitOffer.primaryKind === 'survey' ? (
              <button type="button" className="primary-btn" onClick={() => void window.unvibe.openUrl(BETA_SURVEY_URL)}>
                {limitOffer.primary}
              </button>
            ) : (
              <button type="button" className="primary-btn" onClick={onPlan}>{limitOffer.primary}</button>
            )}
            {limitOffer.showPlan && limitOffer.primaryKind === 'survey' ? (
              <button type="button" className="soft-btn" onClick={onPlan}>{proOpen ? 'Buy a subscription' : 'Pro opens soon'}</button>
            ) : null}
          </div>
        </div>
      ) : (
        <button type="button" className="home-card home-cta" onClick={() => window.unvibe.companionReview()}>
          <span className="home-card__text">
            <b>Explain any code, right where it is</b>
            <small>Select code in any app. Vibe pops up beside it.</small>
          </span>
          <span className="home-cta__keys">{shortcutKeys.map((key, index) => <kbd key={`${index}:${key}`}>{key}</kbd>)}</span>
        </button>
      )}
      {brief ? (
        <button type="button" className="link-btn home-brief" onClick={onBriefs}>
          {`Review what changed: ${brief.filesChanged} file${brief.filesChanged === 1 ? '' : 's'}`}
        </button>
      ) : null}
      {today ? <TodayGoalLine goal={today} /> : null}
      <div className={`home-cols${upNext.length ? '' : ' home-cols--one'}`}>
        {upNext.length ? (
          <section className="home-list home-list--next" aria-labelledby="home-next">
            <header><h2 id="home-next">Up next</h2><span className="home-list__count">{stepsDone} of {steps.length} done</span></header>
            <ol>
              {upNext.map((step) => (
                <li key={step.id}><button type="button" className="home-step" onClick={runStep[step.id]}>
                  <LineIcon className="home-step__icon" d={step.icon} />
                  <span className="home-row__text">
                    <span className="home-row__title">{step.title}</span>
                    <span className="home-row__source">{step.copy}</span>
                  </span>
                </button></li>
              ))}
            </ol>
          </section>
        ) : null}
        <section className="home-list" aria-labelledby="home-recent">
          <header><h2 id="home-recent">Recently understood</h2><button type="button" className="link-btn" onClick={onLibrary}>See all</button></header>
          {rows.length ? (
            <ul>
              {rows.map((row) => (
                <li key={row.id}><button type="button" className="home-row" onClick={onLibrary}>
                  <span className="home-row__text">
                    <span className="home-row__title">{row.title}</span>
                    {row.source ? <span className="home-row__source">{row.source}</span> : null}
                  </span>
                  {row.tone === 'understood'
                    ? <time className="home-row__pill" data-tone="understood" dateTime={row.ts}>{row.pill}</time>
                    : <span className="home-row__pill" data-tone="review">{row.pill}</span>}
                </button></li>
              ))}
            </ul>
          ) : <p className="home-list__empty">Nothing yet. Your first explanation lands here!</p>}
        </section>
      </div>
    </div>
  );
}
