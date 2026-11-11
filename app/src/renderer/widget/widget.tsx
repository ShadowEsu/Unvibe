import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { WidgetEvent } from '../../main/review';
import type { ExplanationLevel } from '../../core/protocol';
import { Buddy, setBuddyMood } from '../shared/buddy';
import { configureTones, playTone } from '../shared/tones';
import { renderRich } from '../shared/richText';
import { ShortAnswer } from '../shared/shortAnswer';
import { linesLabel } from '../../core/linesLabel';
import { BETA_SURVEY_URL, limitOfferCopy } from '../shared/limitOffer';
import { freePlanLine } from '../shared/planStatus';
import { shortcutCaps } from '../shared/prettyShortcut';
import { isWindows, reviewKeyHint, voiceHowTo } from '../shared/platform';
import { selectionSource, selectionTitle } from '../shared/languageName';
import { DepthControl, LEVELS } from './levelChip';
import { AskField, CodeRow, ExplainChips, Findings, PanelToast, SQUASH_MS, StopButton, TOAST_EXIT_MS, TOAST_MS } from './panelBody';
import { QuizActions, QuizCard } from './panelQuiz';
import { AskThread, followUpLive } from './askTab';
import { SavedTab } from './savedTab';
import { Icon, type IconName } from './icons';
import { firstSymbol } from './selectionName';
import { fadeStyle, HOVER_WAKE_MS, nextFade, NOT_FADED, type FadeEvent } from './clickAway';
import { PANEL_THEME_KEY, panelThemeMigration, type ThemePreference } from './themeMigration';
import { useRevealedText } from './reveal';
import { trackWindowAway } from '../shared/windowAway';
import { PasteTarget } from '../shared/pasteTarget';
import { ShortcutGuide, turnOnShortcut } from '../shared/shortcutGuide';
import { ConsentForm } from '../shared/consentForm';
import { CONSENT_PROVIDERS } from '../../core/consent';
import type { PmfDraft } from '../../core/pmf';
import { PmfCard, type PmfCardModel } from './pmfCard';
import { freshState, heldFollowUp, reduceEvent, type PanelState, type Phase } from './panelState';
import '../shared/tokens.css';
import { SegThumb } from '../shared/slidingThumb';

/** The four bottom tabs (SPEC Tabs). */
type View = 'explain' | 'test' | 'ask' | 'saved';

/** Shown while the first words are on their way: Vibe thinks out loud with three real steps. */
function ThinkingCard({ hasCode }: { hasCode: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const a = window.setTimeout(() => setStep(1), 700);
    const b = window.setTimeout(() => setStep(2), 1700);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);
  const steps = [hasCode ? 'Reading your selection' : 'Reading the request', 'Checking project context and secrets', 'Writing the explanation'];
  const notes = [hasCode ? 'hmm, let me read this…' : 'one sec, reading…', 'checking the rest of your project', 'okay, writing it up for you'];
  return (
    <div className="ob-thinking" role="status" aria-live="polite" aria-label="Generating explanation">
      <Buddy mood={step === 2 ? 'reading' : 'thinking'} size={34} label="Vibe is thinking" />
      <div className="ob-thinking__main">
        <p className="ob-thinking__note" key={step}>{notes[step]}</p>
        <ol className="ob-steps">
          {steps.map((label, i) => (
            <li key={label} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
              <i aria-hidden="true">{i < step ? <Icon name="check" size={12} /> : null}</i>{label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** The shortcut as one cap per key (Design Q8): ⌃ U on a Mac, Ctrl Alt U on Windows and Linux (Security N2). */
function Keycaps({ accel }: { accel: string }) {
  return (
    <span className="ob-keys" aria-label={accel ? shortcutCaps(accel).join(' ') : reviewKeyHint}>
      {(accel ? shortcutCaps(accel) : [reviewKeyHint]).map((key, i) => <kbd key={`${key}-${i}`}>{key}</kbd>)}
    </span>
  );
}

/** A Pro-only action in the picker: its existing label ("Explain git diff · Pro") drawn as the label plus a Pro tag. */
function ProLabel({ text }: { text: string }) {
  const [label, tag] = text.split(' · ');
  return <>{label}{tag ? <span className="ob-pro">{tag}</span> : null}</>;
}

/**
 * Calm fallback when ⌘U finds no selection: pick a source, never hard-error. On a Mac without
 * Accessibility it leads with a focused paste box (⌘V explains right away) and a file, then offers
 * the shortcut, whose guide shows here while System Settings is open.
 */
function EmptyPicker({ accel, level }: { accel: string; level: ExplanationLevel }) {
  const [paste, setPaste] = useState('');
  const [hint, setHint] = useState('');
  const [picking, setPicking] = useState(false);
  // On macOS the shortcut copies your selection through Accessibility. Without it the shortcut lands here.
  const [needsAccess, setNeedsAccess] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [grantNote, setGrantNote] = useState('');
  // macOS refused (or is still asking about) System Events, so the shortcut's copy read nothing.
  const [automation, setAutomation] = useState<'automation_denied' | 'automation_timeout' | null>(null);
  const shortcut = shortcutCaps(accel).join(isWindows || !accel ? '+' : '') || reviewKeyHint;
  useEffect(() => {
    let alive = true;
    void window.unvibe.captureBlock().then((block) => { if (alive) setAutomation(block); });
    // A press with the panel already open keeps this mounted; main sends the new answer.
    const off = window.unvibe.onCaptureBlock(setAutomation);
    return () => { alive = false; off(); };
  }, []);
  useEffect(() => {
    let alive = true;
    let missing = false;
    const check = () => void window.unvibe.accessibility().then((r) => {
      const res = r as { granted?: boolean; platform?: string };
      const nowMissing = res.platform === 'darwin' && res.granted === false;
      if (!alive) return;
      setNeedsAccess(nowMissing);
      // The grant just arrived: explain the selection already made, or say what to do in one line.
      if (missing && !nowMissing) {
        void window.unvibe.explainAfterGrant().then(async (result) => {
          if (!alive || result.explained) return;
          // The copy may still fail on System Events; then the Automation note says what to do instead.
          const block = await window.unvibe.captureBlock();
          if (!alive) return;
          setAutomation(block);
          if (!block) setGrantNote(`Unvibe can read your selection now. Select the code again and press ${shortcut}.`);
        });
      }
      missing = nowMissing;
    });
    check();
    // Reflect a grant made in System Settings without a manual re-check.
    const timer = window.setInterval(() => { if (missing) check(); }, 2000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [shortcut]);
  const openGuide = async () => {
    setGuideOpen(true);
    await turnOnShortcut(window.unvibe);
  };

  const chooseFile = async () => {
    setHint('');
    setPicking(true);
    try {
      const result = await window.unvibe.pickFile({ level });
      if (result?.error) setHint(result.error);
      else if (!result?.ok && !result?.cancelled) setHint('Could not open that file.');
    } finally {
      setPicking(false);
    }
  };

  if (needsAccess) {
    return (
      <div className="ob-state ob-picker">
        <div className="ob-state__head"><Buddy mood="wave" size={40} follow label="Vibe" /><h2 className="ob-title">Paste the code here.</h2></div>
        <PasteTarget compact hint="Copy a few lines (⌘C) in your editor, then paste here to explain them."
          onPaste={(text) => window.unvibe.usePaste({ text, level })} />
        <div className="ob-actions">
          <button className="ob-btn ghost" disabled={picking} onClick={() => void chooseFile()}>
            {picking ? 'Opening…' : 'Choose a file…'}
          </button>
        </div>
        {hint ? <p className="ob-sub" role="alert">{hint}</p> : null}
        <p className="ob-sub">or</p>
        <p className="ob-sub">To explain a selection straight from any app, turn on the shortcut. Pressing it sends the selected code to {CONSENT_PROVIDERS.unvibe} through Unvibe. macOS asks once.</p>
        {guideOpen ? (
          <div className="ob-note"><ShortcutGuide buttonClass="ob-btn ghost" /></div>
        ) : (
          <div className="ob-actions">
            <button className="ob-btn ghost" onClick={() => void openGuide()}>Turn on the shortcut</button>
          </div>
        )}
      </div>
    );
  }

  const runPro = async (kind: 'diff' | 'brief' | 'compare') => {
    setPicking(true);
    setHint('');
    try {
      const result = kind === 'compare'
        ? await window.unvibe.explainCompare({ level })
        : await window.unvibe.explainDiff({ brief: kind === 'brief', level });
      if (!result?.ok && !result?.cancelled) setHint(result?.error ?? 'Could not start that review.');
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="ob-state ob-picker">
      <div className="ob-state__head"><Buddy mood="wave" size={40} follow label="Vibe" /><h2 className="ob-title">Ready when you are.</h2></div>
      <p className="ob-sub">
        Let’s make that code click. Select a snippet and press <Keycaps accel={accel} />, or paste it below.
      </p>
      {grantNote ? <div className="ob-note" role="status">{grantNote}</div> : null}
      {automation === 'automation_denied' ? (
        <div className="ob-note" role="status">
          macOS is blocking Unvibe from copying your selection. In System Settings, open Privacy &amp; Security, then Automation, and turn on System Events under Unvibe. Then press {shortcut} again.
          <div className="ob-actions"><button className="ob-btn ghost" onClick={() => void window.unvibe.openAutomation()}>Open Automation settings</button></div>
        </div>
      ) : automation === 'automation_timeout' ? (
        <div className="ob-note" role="status">If macOS asked to let Unvibe control System Events, choose Allow, then press {shortcut} again.</div>
      ) : null}
      <div className="ob-actions">
        <button className="ob-btn" disabled={picking} onClick={() => window.unvibe.useClipboard({ level })}>
          Explain my clipboard
        </button>
        <button className="ob-btn ghost" disabled={picking} onClick={() => void chooseFile()}>
          {picking ? 'Opening…' : 'Choose a file…'}
        </button>
      </div>
      <section className="ob-picker__pro" aria-labelledby="ob-pro-title">
        <h3 className="ob-label" id="ob-pro-title">Review project changes</h3>
        <div className="ob-actions">
          <button className="ob-btn ghost" disabled={picking} onClick={() => void runPro('diff')}><ProLabel text="Explain git diff · Pro" /></button>
          <button className="ob-btn ghost" disabled={picking} onClick={() => void runPro('brief')}><ProLabel text="Change brief · Pro" /></button>
          <button className="ob-btn ghost" disabled={picking} onClick={() => void runPro('compare')}><ProLabel text="Since last understood · Pro" /></button>
        </div>
      </section>
      <label className="sr-only" htmlFor="paste-code">Or paste code</label>
      <textarea
        id="paste-code"
        className="ob-paste"
        rows={3}
        placeholder="Paste a function, diff, or snippet…"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
      />
      {paste.trim() ? (
        <div className="ob-actions">
          <button className="ob-btn" onClick={() => window.unvibe.usePaste({ text: paste, level })}>Explain pasted code</button>
        </div>
      ) : null}
      {hint ? <p className="ob-sub" role="alert">{hint}</p> : null}
    </div>
  );
}

/** An amber problem badge: "!" for a possible secret or an error, the lock for a blocked credential. */
function ProblemHead({ title, lock = false, id }: { title: string; lock?: boolean; id?: string }) {
  return (
    <div className="ob-state__head">
      <span className="ob-badge" aria-hidden="true">{lock ? <Icon name="lock" size={16} /> : '!'}</span>
      <h2 className="ob-title" id={id}>{title}</h2>
    </div>
  );
}

/* ---------------------------------- app ---------------------------------- */

interface UsageState {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  plan: string;
  selections?: { used: number; limit: number; remaining: number; resetsAt: string };
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark'
    || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // Round 2 glass (G1): the motion tokens key off it (widget.css `html[data-r2]`).
  document.documentElement.dataset.r2 = 'g1';
}

/** Main passes Settings › Theme in the page URL, so the first paint already has it (no light flash in dark mode). */
const START_THEME: ThemePreference = ((t) => (t === 'dark' || t === 'system' ? t : 'light'))(new URLSearchParams(window.location.search).get('theme'));
applyTheme(START_THEME);

/** panelOut's length (widget.css). */
const PANEL_EXIT_MS = 160;

const TABS: Array<{ id: View; label: string; icon: IconName }> = [
  { id: 'explain', label: 'Explain', icon: 'code' },
  { id: 'test', label: 'Test me', icon: 'circle-help' },
  { id: 'ask', label: 'Ask', icon: 'message-square' },
  { id: 'saved', label: 'Saved', icon: 'bookmark' },
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Widget() {
  const [s, setS] = useState<PanelState>(freshState);
  const patch = useCallback((p: Partial<PanelState>) => setS((prev) => ({ ...prev, ...p })), []);
  const stateRef = useRef(s);
  stateRef.current = s;
  const [view, setView] = useState<View>('explain');
  const viewRef = useRef(view);
  viewRef.current = view;
  const [savedVersion, setSavedVersion] = useState(0);
  const [accel, setAccel] = useState('');
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [teachOpen, setTeachOpen] = useState(false);
  const [proGate, setProGate] = useState(false);
  // "Understood. Saved to your Library." once main has saved it (Design Q1), for TOAST_MS.
  const [toast, setToast] = useState<{ text: string; leaving?: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  /** performance.now() of the last Understand press, so the note never lands inside Vibe's squash. */
  const understoodAt = useRef(0);
  // While checkout is closed the panel says "Pro opens soon" instead of offering a purchase.
  const [proOpen, setProOpen] = useState(false);
  useEffect(() => { void window.unvibe.billingStatus().then((status) => setProOpen(status.paymentsOpen)); }, []);
  const [features, setFeatures] = useState({ whyExists: true, teachBack: true, voice: false, changeBrief: true });
  const [listening, setListening] = useState(false);
  /** The PMF survey card (FE-09) while it is open in this panel; null when hidden or closed. */
  const [pmf, setPmf] = useState<PmfCardModel | null>(null);
  const pmfClosed = useRef(false);
  const pmfSaveTimer = useRef<number | undefined>(undefined);
  const pmfPending = useRef<PmfDraft | null>(null);

  // Clicking away (Design ruling e): main says when focus left; the pane fades unless woken.
  const [fade, setFade] = useState(NOT_FADED);
  const fadeTo = (event: FadeEvent) => setFade((prev) => nextFade(prev, event));
  const hoverTimer = useRef<number | undefined>(undefined);

  const outOfExplanations = usage ? usage.remaining <= 0 : false;
  const offer = usage ? limitOfferCopy(usage.plan, usage, proOpen) : null;
  const sessionPaused = Boolean(outOfExplanations && offer?.primaryKind === 'survey');

  // The panel leaves the way it came (Motion, app-0151 moment 4): panelOut, then main closes the window. A second
  // close while leaving does nothing; a close from main stays instant, and with reduced motion this one is too.
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const closePanel = useCallback(() => {
    if (leavingRef.current) return;
    if (reducedMotion()) {
      window.unvibe.closeWidget();
      return;
    }
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => window.unvibe.closeWidget(), PANEL_EXIT_MS);
  }, []);

  // Theme follows Settings › Theme (Design ruling c), with the one-time move of the old panel moon.
  useEffect(() => {
    let theme: ThemePreference = START_THEME;
    // The last click-away setting seen; main sends the whole set (theme and click-away together) on any change.
    let behavior: string | undefined;
    void window.unvibe.getSettings().then(async (st) => {
      const settings = st as { theme?: ThemePreference; themeChosen?: boolean; features?: typeof features; soundEffects?: boolean; soundVolume?: number; soundStyle?: 'soft' | 'pixel'; inactiveBehavior?: string };
      theme = settings.theme ?? 'light';
      behavior ??= settings.inactiveBehavior;
      configureTones({ enabled: settings.soundEffects ?? true, volume: settings.soundVolume ?? 0.3, style: settings.soundStyle ?? 'soft' });
      if (settings.features) setFeatures((prev) => ({ ...prev, ...settings.features }));
      let stored: string | null = null;
      try { stored = window.localStorage.getItem(PANEL_THEME_KEY); } catch { /* storage blocked */ }
      const move = panelThemeMigration(stored, settings);
      if (move.setTheme) {
        await window.unvibe.setSettings({ theme: move.setTheme });
        theme = move.setTheme;
      }
      if (move.dropKey) {
        try { window.localStorage.removeItem(PANEL_THEME_KEY); } catch { /* storage blocked */ }
      }
      applyTheme(theme);
    });
    window.unvibe.onPanelSettings((next) => {
      if (next.theme) {
        theme = next.theme;
        applyTheme(theme);
      }
      // Fade ↔ Hide changed: start from the solid panel instead of keeping an old fade. A theme change alone keeps
      // the fade.
      if (next.inactiveBehavior && behavior !== undefined && next.inactiveBehavior !== behavior) setFade((prev) => nextFade(prev, 'back'));
      if (next.inactiveBehavior) behavior = next.inactiveBehavior;
    });
    window.unvibe.onPanelAway((away) => {
      window.clearTimeout(hoverTimer.current);
      setFade((prev) => nextFade(prev, away ? 'away' : 'back'));
    });
    void window.unvibe.usageGet().then((result) => {
      const r = result as { ok?: boolean; data?: UsageState };
      if (r.ok && r.data) setUsage(r.data);
    });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { if (theme === 'system') applyTheme('system'); };
    mq.addEventListener('change', onScheme);
    return () => mq.removeEventListener('change', onScheme);
  }, []);

  useEffect(() => {
    window.unvibe.onReviewEvent((raw) => {
      const ev = raw as WidgetEvent;
      if (ev.type === 'usage') {
        setUsage((current) => ({ used: ev.used, limit: ev.limit, remaining: ev.remaining, resetsAt: ev.resetsAt, plan: ev.plan, selections: current?.selections }));
      }
      if (ev.type === 'error' && 'code' in ev && ev.code === 'pro_required') setProGate(true);
      // A new selection, the AI agreement or a possible secret shows on Explain: a follow-up held for one of these
      // arrives while Ask is open, and Ask doesn't draw those sheets (review MUST). A blocked follow-up stays in the
      // Ask thread (reduceEvent); a blocked explanation shows its sheet on Explain.
      if (ev.type === 'init' || ev.type === 'consentNeeded' || ev.type === 'consent' || (ev.type === 'blocked' && !followUpLive(stateRef.current.followUps))) {
        setView('explain');
        setTeachOpen(false);
      }
      if (ev.type === 'graded') {
        setBuddyMood(ev.correct ? 'celebrate' : 'confused');
        // A right answer sounds once: Vibe's celebrate reaction plays its tone.
        if (!ev.correct) playTone('wrong');
      }
      if (ev.type === 'status' && !('part' in ev && ev.part === 'detail')) playTone('think');
      if (ev.type === 'done' && !('part' in ev && ev.part === 'detail')) playTone('done');
      if (ev.type === 'understood') {
        window.clearTimeout(toastTimer.current);
        // Three steps (Motion, app-0151 moment 2): wait out Vibe's squash, hold TOAST_MS, then leave over TOAST_EXIT_MS.
        const show = () => {
          setToast({ text: 'Understood. Saved to your Library.' });
          setSavedVersion((v) => v + 1);
          toastTimer.current = window.setTimeout(() => {
            setToast((t) => (t ? { ...t, leaving: true } : t));
            toastTimer.current = window.setTimeout(() => setToast(null), TOAST_EXIT_MS);
          }, TOAST_MS);
        };
        const wait = understoodAt.current + SQUASH_MS - performance.now();
        if (wait > 0) toastTimer.current = window.setTimeout(show, wait);
        else show();
      }
      setS((prev) => reduceEvent(prev, ev));
    });
    window.unvibe.widgetReady();
    window.unvibe.appInfo().then((i) => setAccel(i.shortcut));
  }, []);

  // The answer and More detail reveal whole words as they stream, and the arriving words fade in (reveal.ts).
  const answer = useRevealedText(s.text, s.phase === 'streaming', s.phase === 'streaming' || s.phase === 'done');
  const stillTyping = answer.typing;
  const detail = useRevealedText(s.detail.text, s.detail.phase === 'streaming', s.detail.phase === 'streaming' || s.detail.phase === 'done');
  const phase = s.phase;
  const answerReady = phase === 'done' && !stillTyping && s.text.length > 0;
  const asking = followUpLive(s.followUps);

  // Height fits the content (360–560, main clamps): header + the body's natural height + footer + tabs.
  const headRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const parts = [headRef.current?.offsetHeight, innerRef.current?.offsetHeight, footRef.current?.offsetHeight, tabsRef.current?.offsetHeight];
        window.unvibe.fitHeight(Math.ceil(parts.reduce<number>((sum, h) => sum + (h ?? 0), 0)));
      });
    };
    const observer = new ResizeObserver(measure);
    for (const el of [headRef.current, innerRef.current, footRef.current]) if (el) observer.observe(el);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [view]);

  // Autoscroll while the answer (or a follow-up) streams.
  useEffect(() => {
    if ((phase === 'streaming' || asking) && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [answer.text, phase, asking, s.followUps]);

  // One run at a time: while a follow-up streams, a new explanation would cancel it silently and its events would land
  // in the Ask thread while main saved them as the lesson (review MUST). Explain's controls are disabled meanwhile too.
  const followUpBusy = () => followUpLive(stateRef.current.followUps);
  const request = (opts: Record<string, unknown>) => {
    if (followUpBusy()) return;
    if (outOfExplanations) {
      patch({ phase: 'error', error: offer ? offer.body : 'You have reached your monthly explanation limit. Open Plan to upgrade.' });
      return;
    }
    window.unvibe.request({ level: s.level, ...opts });
  };

  /**
   * "More detail" under a short answer: the first press streams the full depth below the short
   * answer (nothing above it moves); after that the button only shows or hides it. A failed run
   * can be asked for again. Focus stays on the button.
   */
  const toggleDetail = () => {
    const current = s.detail;
    if (current.phase === 'done' || current.phase === 'streaming') {
      patch({ detail: { ...current, open: !current.open } });
      return;
    }
    // Showing or hiding loaded detail is fine while a follow-up streams; starting a run is not (one run at a time).
    if (followUpBusy()) return;
    patch({ detail: { phase: 'streaming', text: '', error: '', open: true } });
    // Not request(): More detail is a follow-up, not a new explanation, so an exhausted explanation
    // allowance must not replace the answer on screen; a refusal shows under the short answer.
    window.unvibe.request({ level: s.level, moreDetail: true });
  };

  const pick = (l: ExplanationLevel) => {
    if (outOfExplanations || followUpBusy()) return;
    patch({ level: l });
    if (stateRef.current.phase === 'done') window.unvibe.request({ level: l });
  };

  // Test me: the tab asks for a question when there is none (or the last could not be written).
  const questionRef = useRef<HTMLHeadingElement>(null);
  const openQuiz = (another = false) => {
    setView('test');
    if (!another && s.quiz && s.quiz.phase !== 'failed') return;
    patch({ quiz: { phase: 'loading' } });
    window.unvibe.testMe();
  };
  const quizKey = view === 'test' && s.quiz?.question ? `q:${s.quiz.index ?? 1}:${s.quiz.question}` : null;
  useEffect(() => { if (quizKey) questionRef.current?.focus(); }, [quizKey]);

  const askInputRef = useRef<HTMLInputElement>(null);
  /** Sends a follow-up into the Ask thread; `consented` after "Send anyway" on a possible secret in it. */
  const askFollowUp = (question: string, consented = false) => {
    setS((prev) => ({
      ...prev,
      ask: '',
      refusedQuestion: '',
      phase: prev.phase === 'consent' ? 'done' : prev.phase,
      followUps: [...prev.followUps, { id: Date.now(), question, answer: '', phase: 'waiting' }],
    }));
    setView('ask');
    window.unvibe.request({ level: s.level, question, ...(consented ? { consented: true } : {}) });
  };

  const sendAsk = () => {
    const question = s.ask.trim();
    if (!question || followUpBusy()) return;
    if (outOfExplanations) {
      // The limit sheet lives on Explain; the question stays in the field.
      request({ question });
      setView('explain');
      return;
    }
    askFollowUp(question);
  };

  /** Back from a sheet that held a follow-up: the answer again, the question back in the Ask field. */
  const returnHeldQuestion = (phase: Phase) => {
    patch({ phase, consentProvider: null, ask: s.refusedQuestion, refusedQuestion: '' });
    setView('ask');
  };

  const toggleSave = async () => {
    const result = await window.unvibe.saveLesson(!s.pinned);
    if (result.ok) {
      patch({ pinned: result.pinned === true });
      setSavedVersion((v) => v + 1);
    }
  };

  // While the AI agreement is open only Explain (where it shows) is reachable: nothing behind it before it's answered (Design S-1).
  const tabEnabled = (id: View) => phase === 'aiConsent' ? id === 'explain'
    : id === 'test' ? Boolean(s.quiz) || answerReady : id === 'ask' ? phase === 'done' || s.followUps.length > 0 : true;
  const choose = (id: View) => {
    if (!tabEnabled(id)) return;
    if (id === 'test') openQuiz();
    else setView(id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'w') closePanel();
      // Esc steps back to the explanation from the other tabs.
      else if (e.key === 'Escape' && viewRef.current !== 'explain') setView('explain');
      else if (mod && e.key >= '1' && e.key <= '5') pick(LEVELS[Number(e.key) - 1]!.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, outOfExplanations]);

  // The survey card waits until an explanation has fully finished, typing included, and is asked
  // for again after each one until it is sent or closed. Main decides eligibility.
  useEffect(() => {
    if (!answerReady || pmf || pmfClosed.current) return;
    let live = true;
    void window.unvibe.pmfState().then((state) => {
      if (live && state.show && !pmfClosed.current) setPmf({ draft: state.draft, stage: 'form', error: '', installId: '' });
    }).catch(() => undefined);
    return () => { live = false; };
  }, [answerReady, pmf]);
  // After the thanks, the next explanation starts without the card.
  useEffect(() => {
    if (phase === 'streaming' && pmf?.stage === 'thanks') {
      pmfClosed.current = true;
      setPmf(null);
    }
  }, [phase, pmf?.stage]);
  const flushPmfDraft = () => {
    window.clearTimeout(pmfSaveTimer.current);
    if (pmfPending.current) window.unvibe.pmfSaveDraft(pmfPending.current);
    pmfPending.current = null;
  };
  // Answers are saved on this computer as they are typed (batched), and once more on close.
  useEffect(() => () => flushPmfDraft(), []);
  const changePmf = (draft: PmfDraft) => {
    setPmf((current) => (current ? { ...current, draft } : current));
    pmfPending.current = draft;
    window.clearTimeout(pmfSaveTimer.current);
    pmfSaveTimer.current = window.setTimeout(flushPmfDraft, 400);
  };
  const dismissPmf = () => {
    window.clearTimeout(pmfSaveTimer.current);
    pmfPending.current = null;
    pmfClosed.current = true;
    setPmf(null);
    void window.unvibe.pmfDismiss();
  };
  const sendPmf = () => {
    if (!pmf || pmf.stage === 'sending') return;
    window.clearTimeout(pmfSaveTimer.current);
    pmfPending.current = null;
    const { draft } = pmf;
    setPmf({ draft, stage: 'sending', error: '', installId: '' });
    void window.unvibe.pmfSend(draft)
      .catch(() => ({ ok: false as const, error: 'Could not send. Your answers are still here, so you can try again.', field: undefined, retry: true as const }))
      .then((result) => {
        setPmf((current) => {
          if (!current) return current;
          return result.ok
            ? { ...current, stage: 'thanks', error: '', installId: result.installId }
            : { ...current, stage: 'form', error: result.error, errorField: result.field, retry: result.retry === true };
        });
      });
  };

  const askWhy = () => {
    void window.unvibe.lookupOrigin().then((raw) => {
      const result = raw as { ok?: boolean; error?: string; report?: { facts: Array<{ label: string; value: string }>; inference: string } };
      patch({
        originOpen: true,
        originError: result?.ok ? '' : (result?.error ?? 'Unvibe could not find documented history for this code.'),
        originFacts: result?.report?.facts ?? [],
        originInference: result?.report?.inference ?? '',
      });
    });
  };

  // Header (SPEC: 50 pt): Vibe, the selection's first symbol, "N lines · language", and the count only when ≤ 10 are left.
  const hasCode = Boolean(s.meta.lines);
  const symbol = firstSymbol(s.meta.preview) ?? s.meta.file?.split(/[\\/]/).pop();
  const title = hasCode ? symbol ?? selectionTitle(s.meta.lines!, s.meta.language) : 'Unvibe';
  const language = s.meta.language && s.meta.language !== 'plaintext' ? s.meta.language : undefined;
  const left = usage && usage.remaining <= 10 ? `${usage.remaining} left` : undefined;
  const meta = [hasCode ? linesLabel(s.meta.lines!) : undefined, language, hasCode ? selectionSource(s.meta.sourceApp, s.meta.file) : undefined, left].filter(Boolean).join(' · ');
  const phaseLabel = phase === 'boot' ? 'capturing' : phase === 'ready' ? 'reading' : phase === 'aiConsent' || phase === 'confirm' ? 'waiting for you' : phase === 'streaming' ? 'explaining' : phase === 'done' ? 'ready to learn' : phase === 'empty' ? 'waiting' : phase;
  const depthLabel = LEVELS.find((l) => l.id === s.level)?.label;
  const showDepth = !sessionPaused && hasCode && (phase === 'ready' || phase === 'streaming' || phase === 'done');
  const fadeNow = fadeStyle(fade, reducedMotion());

  const onUnderstand = () => {
    // Vibe is happy once and the panel stays open; the note comes when main has saved it (Design Q1).
    understoodAt.current = performance.now();
    setBuddyMood('happy');
    patch({ understood: true });
    window.unvibe.gotIt();
  };

  const explainBody = () => {
    if (sessionPaused && offer) {
      return (
        <div className="ob-state" role="status">
          <h2 className="ob-title">{offer.title}</h2>
          <p className="ob-sub">{offer.body}</p>
          <div className="ob-actions">
            <button className="ob-btn" onClick={() => void window.unvibe.openUrl(BETA_SURVEY_URL)}>{offer.primary}</button>
            {offer.showPlan ? (
              <button className="ob-btn ghost" onClick={() => window.unvibe.openPlan()}>{proOpen ? 'Buy a subscription' : 'Pro opens soon'}</button>
            ) : null}
          </div>
        </div>
      );
    }
    const top = showDepth ? (
      <>
        <DepthControl level={s.level} plan={usage?.plan} disabled={outOfExplanations || asking} onPick={(id) => { setProGate(false); pick(id); }} />
        {s.meta.preview ? <CodeRow id="ob-code" code={s.meta.preview} open={s.codeOpen} onToggle={() => patch({ codeOpen: !stateRef.current.codeOpen })} /> : null}
      </>
    ) : null;
    switch (phase) {
      case 'boot':
        return <div className="ob-state" role="status"><p className="ob-sub">Capturing selection…</p></div>;
      case 'aiConsent':
        return s.consentProvider ? (
          <div className="ob-state">
            <ConsentForm
              key={s.consentProvider}
              provider={s.consentProvider}
              buttonClass="ob-btn"
              onAgreed={() => {
                // An explanation already on screen (a follow-up was refused): back to it, ask again from there.
                // A link capture: the confirm sheet, so the code is seen before it's sent.
                // Captured code that waited on this computer: explain it now. Nothing captured: a
                // clipboard explain asked for just before agreeing is read now and shown on the confirm
                // sheet (QA F1, Security U-F1-L2), otherwise the picker.
                const next: Phase | null = s.text ? 'done' : s.confirmAfterConsent ? 'confirm' : s.meta.lines ? null : 'empty';
                if (next === 'empty') {
                  patch({ phase: 'boot', consentProvider: null, agreedJustNow: true });
                  void window.unvibe.explainAfterConsent().then((result) => {
                    if (!result.explained) patch({ phase: 'empty', agreedJustNow: false });
                  });
                } else if (next === 'done' && s.refusedQuestion) returnHeldQuestion('done');
                else if (next) patch({ phase: next, consentProvider: null });
                else request({});
              }}
              onCancel={closePanel}
            />
          </div>
        ) : null;
      case 'ready':
        return (
          <>
            {top}
            <div className="ob-state" role="status">
              <div className="ob-progress" aria-label="Explanation progress"><span className="on">1 · captured</span><span className="on">2 · filtered</span><span>3 · explaining</span></div>
              <h2 className="ob-title">Reading your code in context…</h2>
              <p className="ob-sub">Parsing your selection and generating the explanation.</p>
            </div>
          </>
        );
      case 'confirm':
        return (
          <div className="ob-state" role="alertdialog" aria-labelledby="confirm-title">
            <h2 className="ob-title" id="confirm-title">Explain this code?</h2>
            <p className="ob-meta">{[language ?? 'Code selection', linesLabel(s.meta.lines ?? 0), s.meta.sourceApp].filter(Boolean).join(' · ')}</p>
            {s.meta.preview ? (
              <section className="ob-preview" aria-label={s.confirmFromHighlight ? 'The last text you highlighted' : 'Code from your clipboard'}>
                <pre tabIndex={0}><code>{s.meta.preview}</code></pre>
              </section>
            ) : null}
            <p className="ob-sub">
              {s.confirmFromHighlight
                ? 'This is the last text you highlighted, in any app. It may be from earlier, so check it is the code you mean.'
                : s.confirmAfterAgree
                  ? 'This is what is on your clipboard now.'
                  : 'Your editor or a link asked Unvibe to explain what is on your clipboard.'}{' '}
              Nothing has been sent yet. Explain sends it to {s.providerName}.
            </p>
            <div className="ob-actions">
              <button className="ob-btn" onClick={() => request({})}>Explain</button>
              <button className="ob-btn ghost" onClick={closePanel}>Cancel</button>
            </div>
          </div>
        );
      case 'empty':
        return <EmptyPicker accel={accel} level={s.level} />;
      case 'consent':
        // Design README §4: Cancel stays the primary, Send anyway the quiet one.
        return (
          <div className="ob-state" role="alert">
            <ProblemHead title="Possible secret detected" />
            <Findings findings={s.findings} />
            <p className="ob-sub">Nothing has been sent. Send anyway, or close and clean the selection.</p>
            <div className="ob-actions">
              <button className="ob-btn" onClick={() => (s.refusedQuestion ? returnHeldQuestion('done') : closePanel())}>Cancel</button>
              <button className="ob-btn ghost" onClick={() => { const held = heldFollowUp(s); if (held) askFollowUp(held, true); else request({ consented: true }); }}>Send anyway</button>
            </div>
          </div>
        );
      case 'blocked':
        return (
          <div className="ob-state" role="alert">
            <ProblemHead title="Blocked: credential detected" lock />
            <Findings findings={s.findings} />
            <p className="ob-sub">Nothing was sent. Remove the secret from the selection or your question and try again.</p>
          </div>
        );
      case 'error':
        return (
          <div className="ob-state" role="alert">
            <ProblemHead title={outOfExplanations && offer ? offer.title : proGate ? 'Pro feature' : "Couldn't explain that"} />
            <p className="ob-sub">{s.error}</p>
            {proGate && !outOfExplanations && !proOpen ? <p className="ob-sub">{freePlanLine(usage)}</p> : null}
            <div className="ob-actions">
              {outOfExplanations || proGate ? (
                <>
                  <button className="ob-btn" onClick={() => {
                    if (offer?.primaryKind === 'survey') void window.unvibe.openUrl(BETA_SURVEY_URL);
                    else window.unvibe.openPlan();
                  }}>
                    {outOfExplanations && offer ? offer.primary : proOpen ? 'Upgrade to Pro' : 'Pro opens soon'}
                  </button>
                  {outOfExplanations && offer?.showPlan && offer.primaryKind === 'survey' ? (
                    <button className="ob-btn ghost" onClick={() => window.unvibe.openPlan()}>{proOpen ? 'Buy a subscription' : 'Pro opens soon'}</button>
                  ) : (
                    <button className="ob-btn ghost" onClick={() => { setProGate(false); window.unvibe.openStudy(); }}>
                      {outOfExplanations ? 'Return to saved learning' : 'Maybe later'}
                    </button>
                  )}
                </>
              ) : (
                <button className="ob-btn" onClick={() => request({})}>Retry</button>
              )}
            </div>
          </div>
        );
      case 'streaming':
      case 'done':
        return (
          <>
            {top}
            <div className="ob-answer" role="region" aria-label="Explanation" aria-live="polite" aria-atomic="false">
              {answer.text
                ? (s.short ? <ShortAnswer text={answer.text} streaming={stillTyping} words={answer.words} /> : renderRich(answer.text, stillTyping, { words: answer.words }))
                : <ThinkingCard hasCode={Boolean(s.meta.preview)} />}
            </div>
            {s.short && phase === 'done' && !stillTyping ? (
              <div className="more-detail">
                <button type="button" className="ob-link more-detail__toggle" aria-expanded={s.detail.open} aria-controls="more-detail" onClick={toggleDetail}>
                  {s.detail.open ? 'Less detail' : 'More detail'}
                </button>
                {s.detail.open ? (
                  <div className="ob-answer more-detail__body" id="more-detail">
                    {detail.text
                      ? renderRich(detail.text, detail.typing, { words: detail.words })
                      : s.detail.phase === 'streaming' ? <p className="ob-sub" role="status">Writing more detail…</p> : null}
                    {s.detail.phase === 'error' ? <p className="ob-sub" role="alert">{s.detail.error}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {outOfExplanations && offer && offer.primaryKind !== 'survey' ? (
              <div className="ob-note" role="status">
                <strong>{offer.title}</strong>
                <p>{offer.body}</p>
                <button type="button" className="ob-btn" onClick={() => window.unvibe.openPlan()}>{offer.primary}</button>
              </div>
            ) : null}
            {pmf && answerReady ? (
              <PmfCard model={pmf} onChange={changePmf} onSend={sendPmf} onDismiss={dismissPmf} onClose={() => { pmfClosed.current = true; setPmf(null); }} />
            ) : null}
          </>
        );
    }
  };

  const askField = (
    <AskField value={s.ask} disabled={stillTyping || asking} inputRef={askInputRef} onChange={(ask) => patch({ ask })} onSend={sendAsk}>
      {view === 'ask' && features.voice ? (
        <button
          type="button"
          className={`ob-chip${listening ? ' is-on' : ''}`}
          aria-pressed={listening}
          title={isWindows ? 'Ask out loud with Windows voice typing' : 'Ask out loud with Mac Dictation'}
          onClick={() => {
            setListening((v) => !v);
            askInputRef.current?.focus();
          }}
        >
          🎙 Speak
        </button>
      ) : null}
    </AskField>
  );

  const askBody = (
    <div className="ob-askview">
      {s.followUps.length ? <AskThread followUps={s.followUps} /> : <p className="ob-sub">Why does this exist? What breaks if I remove it?</p>}
      {answerReady && (features.whyExists || features.teachBack) ? (
        <div className="ob-chips">
          {features.whyExists ? <button type="button" className="ob-chip" onClick={askWhy}>Why does this exist?</button> : null}
          {features.teachBack ? <button type="button" className={`ob-chip${teachOpen ? ' is-on' : ''}`} aria-pressed={teachOpen} onClick={() => setTeachOpen((open) => !open)}>Teach it back</button> : null}
        </div>
      ) : null}
      {s.originOpen ? (
        <div className="ob-note" role="region" aria-label="Why this exists">
          <div className="ob-label">Source facts</div>
          {s.originError ? <p className="ob-sub">{s.originError}</p> : null}
          {s.originFacts.map((fact) => <p key={fact.label}><strong>{fact.label}.</strong> {fact.value}</p>)}
          <p>{s.originInference || 'No documented rationale found.'}</p>
        </div>
      ) : null}
      {features.teachBack && teachOpen && answerReady ? (
        <div className="ob-note" role="region" aria-label="Teach it back">
          <div className="ob-label">Teach it back</div>
          <textarea className="ob-paste" rows={3} placeholder="Explain this change in your own words." value={s.teachAnswer} onChange={(e) => patch({ teachAnswer: e.target.value })} />
          <div className="ob-actions">
            <button
              type="button"
              className="ob-btn ghost"
              disabled={!s.teachAnswer.trim()}
              onClick={() => {
                void window.unvibe.gradeTeachBack({ answer: s.teachAnswer }).then((raw) => {
                  const result = raw as { ok?: boolean; result?: { checks: Array<{ topic: string; mark: 'covered' | 'partial' | 'missed' }>; evidence: string; note: string } };
                  if (!result?.result) return;
                  patch({ teachChecks: result.result.checks, teachEvidence: result.result.evidence, teachNote: result.result.note });
                });
              }}
            >
              Check understanding
            </button>
          </div>
          {s.teachEvidence ? (
            <div className="ob-teach">
              {s.teachChecks.map((check) => (
                <p key={check.topic}>
                  {check.mark === 'covered' ? <Icon name="check" size={13} /> : check.mark === 'partial' ? <span aria-hidden="true">△</span> : <Icon name="x" size={13} />} {check.topic}
                </p>
              ))}
              <p>Understanding evidence: {s.teachEvidence}</p>
              <p className="ob-sub">{s.teachNote}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {listening ? <p className="ob-sub" role="note">{voiceHowTo}{!isWindows ? ' Nothing? Turn on Dictation in System Settings, Keyboard.' : ''}</p> : null}
    </div>
  );

  const footer = () => {
    if (view === 'explain') {
      if (phase === 'streaming') return <StopButton onStop={() => window.unvibe.cancel()} />;
      if (phase !== 'done') return null;
      return (
        <>
          <ExplainChips busy={stillTyping || asking} understood={s.understood} pinned={s.pinned} onUnderstand={onUnderstand} onSave={() => void toggleSave()} onDifferent={() => request({ variant: 'different' })}>
            {s.mock ? <span className="ob-meta">mock AI. Set ANTHROPIC_API_KEY for real explanations</span> : null}
          </ExplainChips>
          {askField}
        </>
      );
    }
    if (view === 'test') {
      return s.quiz ? <QuizActions quiz={s.quiz} onAnother={() => openQuiz(true)} onRetry={() => openQuiz(true)} onClose={() => setView('explain')} /> : null;
    }
    if (view === 'ask') return asking ? <StopButton onStop={() => window.unvibe.cancel()} /> : phase === 'done' ? askField : null;
    return null;
  };

  return (
    <div
      className={`ob u-rim ob--${phase}${leaving ? ' is-leaving' : ''}`}
      aria-label="Unvibe"
      style={{ opacity: fadeNow.opacity, transition: `opacity ${fadeNow.transitionMs}ms var(--u-ease)` }}
      onPointerDown={() => fadeTo('press')}
      onMouseEnter={() => {
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => fadeTo('hoverWake'), HOVER_WAKE_MS);
      }}
      onMouseLeave={() => {
        window.clearTimeout(hoverTimer.current);
        fadeTo('leave');
      }}
    >
      <header className="ob-head" ref={headRef}>
        <span className="ob-head__vibe" aria-hidden="true">
          <Buddy mood={phase === 'streaming' ? (s.text ? 'reading' : 'thinking') : phase === 'error' || phase === 'blocked' ? 'confused' : 'idle'} size={20} label="Vibe" listen />
        </span>
        <div className="ob-head__text">
          <span className="ob-head__title">{title}</span>
          {meta ? <span className="ob-meta">{meta}</span> : null}
        </div>
        <span className="sr-only" role="status">{phaseLabel}</span>
        <button type="button" className="ob-head__close" aria-label="Close panel" title="Close" onClick={closePanel}>
          <Icon name="x" size={16} />
        </button>
      </header>
      <div className="ob-scroll" ref={scrollRef} tabIndex={-1}>
        <div className="ob-body" ref={innerRef} key={view} id="ob-tabpanel" role="tabpanel" aria-labelledby={`ob-tab-${view}`}>
          {view === 'explain' ? explainBody() : null}
          {view === 'test' ? (
            <section aria-label="Test me">
              {s.quiz ? <QuizCard quiz={s.quiz} depth={depthLabel} questionRef={questionRef} onAnswer={(i) => {
                if (stateRef.current.quiz?.phase !== 'answering') return;
                patch({ quiz: { ...stateRef.current.quiz, choice: i, phase: 'grading' } });
                window.unvibe.answer(i);
              }} /> : null}
            </section>
          ) : null}
          {view === 'ask' ? askBody : null}
          {view === 'saved' ? <SavedTab version={savedVersion} /> : null}
        </div>
      </div>
      <div className="ob-foot" ref={footRef}>
        <div className="ob-toast-region" role="status">{toast ? <PanelToast text={toast.text} leaving={toast.leaving} /> : null}</div>
        {footer()}
      </div>
      {/* Arrows move focus only; Enter or Space opens a tab (Test me asks for a question, so moving must not). */}
      <nav
        className="ob-tabs"
        ref={tabsRef}
        role="tablist"
        aria-label="Panel"
        onKeyDown={(event) => {
          const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
          const at = Math.max(0, tabs.indexOf(document.activeElement as HTMLButtonElement));
          const to = event.key === 'ArrowRight' ? (at + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (at - 1 + tabs.length) % tabs.length
            : event.key === 'Home' ? 0
            : event.key === 'End' ? tabs.length - 1
            : -1;
          if (to < 0) return;
          event.preventDefault();
          tabs[to]?.focus();
        }}
      >
        <SegThumb />
        {TABS.map((tab) => {
          const on = view === tab.id;
          const enabled = tabEnabled(tab.id);
          return (
            <button
              key={tab.id}
              id={`ob-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={on ? 'ob-tabpanel' : undefined}
              tabIndex={on ? 0 : -1}
              aria-disabled={!enabled || undefined}
              className={`ob-tab${on ? ' is-on' : ''}`}
              onClick={() => choose(tab.id)}
            >
              <Icon name={tab.icon} size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

trackWindowAway();
createRoot(document.getElementById('root')!).render(<Widget />);
