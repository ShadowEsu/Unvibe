import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { WidgetEvent } from '../../main/review';
import type { ExplanationLevel, QuizMode } from '../../core/protocol';
import type { SecretFinding } from '../../core/secretFilter';
import { Buddy, setBuddyMood } from '../shared/buddy';
import { configureTones, playTone } from '../shared/tones';
import { renderRich } from '../shared/richText';
import { BETA_SURVEY_URL, limitOfferCopy } from '../shared/limitOffer';
import { freePlanLine } from '../shared/planStatus';
import { prettyShortcut } from '../shared/prettyShortcut';
import { deviceName, isWindows, reviewKeyHint, voiceHowTo } from '../shared/platform';
import { UsageRings } from '../shared/usageRings';
import { PasteTarget } from '../shared/pasteTarget';
import { ShortcutGuide, turnOnShortcut } from '../shared/shortcutGuide';
import { ConsentForm } from '../shared/consentForm';
import type { ConsentProvider } from '../../core/consent';
import '../shared/tokens.css';

/**
 * `aiConsent`: the first-send agreement (sending code to the provider, Terms, 18+);
 * `confirm`: a link started this review, Explain sends it; `consent`: a secret was found.
 */
type Phase = 'boot' | 'ready' | 'aiConsent' | 'confirm' | 'empty' | 'consent' | 'blocked' | 'streaming' | 'done' | 'error';

interface Quiz {
  phase: 'loading' | 'answering' | 'grading' | 'graded' | 'failed';
  /** Why a question could not be written (phase 'failed'). */
  error?: string;
  question?: string;
  options?: string[];
  conceptLabel?: string;
  choice?: number;
  correct?: boolean;
  answerIndex?: number;
  rationale?: string;
  index?: number;
  total?: number;
  mode?: QuizMode;
  hasMissed?: boolean;
}

interface EntryMeta {
  sourceApp?: string | null;
  file?: string;
  lines?: number;
  language?: string;
  preview?: string;
}

interface HistoryEntry {
  id: string;
  text: string;
  meta: EntryMeta;
  level: ExplanationLevel;
  at: string;
}

interface TabState {
  id: string;
  label: string;
  phase: Phase;
  meta: EntryMeta;
  text: string;
  level: ExplanationLevel;
  findings: SecretFinding[];
  error: string;
  mock: boolean;
  ask: string;
  quiz: Quiz | null;
  quizHidden?: boolean;
  history: HistoryEntry[];
  originOpen: boolean;
  originError: string;
  originFacts: Array<{ label: string; value: string }>;
  originInference: string;
  teachAnswer: string;
  teachNote: string;
  teachChecks: Array<{ topic: string; mark: 'covered' | 'partial' | 'missed' }>;
  teachEvidence: string;
  /** The provider the consent form names while phase is `aiConsent`. */
  consentProvider: ConsentProvider | null;
  /** A link started this review: after agreeing, show the confirm sheet, not an explanation. */
  confirmAfterConsent: boolean;
  /** Agree was just pressed with nothing captured; main is reading the clipboard it asked for. */
  agreedJustNow: boolean;
  /** The confirm sheet shows the clipboard read right after Agree, not a link's capture. */
  confirmAfterAgree: boolean;
  /** Who Explain sends the code to, for the confirm sheet (Security U10). */
  providerName: string;
}

const LEVELS: Array<{ id: ExplanationLevel; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
];

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
    <div className="thinking" role="status" aria-live="polite" aria-label="Generating explanation">
      <div className="thinking__vibe"><Buddy mood={step === 2 ? 'reading' : 'thinking'} size={46} label="Vibe is thinking" /></div>
      <div className="thinking__main">
        <p className="thinking__note" key={step}>{notes[step]}</p>
        <ol className="thinking__steps">
          {steps.map((label, i) => (
            <li key={label} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}><i aria-hidden="true" />{label}</li>
          ))}
        </ol>
        <div className="thinking__lines" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </div>
  );
}

function ToolIcon({ name }: { name: 'explain' | 'depth' | 'quiz' | 'ask' | 'library' | 'why' | 'teach' }) {
  const paths = {
    explain: 'M7 4 3 8l4 4 M13 4l4 4-4 4 M11 2 9 14',
    depth: 'M3 4h14 M5 8h10 M7 12h6',
    quiz: 'M6.5 6a3.5 3.5 0 1 1 5.1 3.1c-1.7.9-2.1 1.6-2.1 2.9 M9.5 16h.01',
    ask: 'M4 15 16 3 M8 3h8v8',
    library: 'M4 3h10a2 2 0 0 1 2 2v11H6a2 2 0 0 0-2 2V3z M6 16h10',
    why: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M10 6v5 M10 13.5v.5',
    teach: 'M3 7l7-3 7 3-7 3-7-3z M6 8.5V12c0 1.5 2 2.5 4 2.5s4-1 4-2.5V8.5',
  } as const;
  return <span className="widget-tool-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d={paths[name]} /></svg></span>;
}

function newTab(id: string, label: string): TabState {
  return {
    id,
    label,
    phase: 'boot',
    meta: {},
    text: '',
    level: 'intermediate',
    findings: [],
    error: '',
    mock: false,
    ask: '',
    quiz: null,
    history: [],
    originOpen: false,
    originError: '',
    originFacts: [],
    originInference: '',
    teachAnswer: '',
    teachNote: '',
    teachChecks: [],
    teachEvidence: '',
    consentProvider: null,
    confirmAfterConsent: false,
    agreedJustNow: false,
    confirmAfterAgree: false,
    providerName: 'Google Gemini',
  };
}

function prettyAccel(accel: string): string {
  return prettyShortcut(accel);
}

const RESIZE_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

/** Grips sit on the visible border so resize starts on the line, not an invisible outer rim. */
function ResizeGrips() {
  const onDown = (edge: (typeof RESIZE_EDGES)[number]) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.unvibe.widgetResizeStart(edge);
    const end = () => {
      window.unvibe.widgetResizeEnd();
      window.removeEventListener('mouseup', end);
      window.removeEventListener('blur', end);
    };
    window.addEventListener('mouseup', end);
    window.addEventListener('blur', end);
  };
  return (
    <>
      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          className={`rz rz--${edge}`}
          aria-hidden="true"
          onMouseDown={onDown(edge)}
        />
      ))}
    </>
  );
}

/**
 * Calm fallback when ⌘U finds no selection: pick a source, never hard-error. On a Mac without
 * Accessibility it leads with a focused paste box (⌘V explains right away) and a file, then offers
 * the shortcut, whose guide shows here while System Settings is open.
 */
function EmptyPicker({
  shortcut,
  level,
}: {
  shortcut: string;
  level: ExplanationLevel;
  onBusy?: (busy: boolean) => void;
}) {
  const [paste, setPaste] = useState('');
  const [hint, setHint] = useState('');
  const [picking, setPicking] = useState(false);
  // On macOS the shortcut copies your selection through Accessibility. Without it the shortcut lands here.
  const [needsAccess, setNeedsAccess] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [grantNote, setGrantNote] = useState('');
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
        void window.unvibe.explainAfterGrant().then((result) => {
          if (alive && !result.explained) setGrantNote(`Unvibe can read your selection now. Select the code again and press ${shortcut}.`);
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
      <div className="state empty-picker empty-picker--paste">
        <div className="state__vibe"><Buddy mood="wave" size={58} follow label="Vibe" /></div>
        <div className="big">Paste the code here.</div>
        <PasteTarget compact hint="Copy a few lines (⌘C) in your editor, then paste here to explain them."
          onPaste={(text) => window.unvibe.usePaste({ text, level })} />
        <div className="empty-actions">
          <button className="btn ghost" disabled={picking} onClick={() => void chooseFile()}>
            {picking ? 'Opening…' : 'Choose a file…'}
          </button>
        </div>
        {hint ? <div className="sub empty-hint">{hint}</div> : null}
        <div className="empty-or">or</div>
        <div className="sub">To explain a selection straight from any app, turn on the shortcut. Pressing it sends the selected code to Google Gemini through Unvibe. macOS asks once.</div>
        {guideOpen ? (
          <div className="access-note"><ShortcutGuide buttonClass="btn ghost" /></div>
        ) : (
          <div className="empty-actions">
            <button className="btn ghost" onClick={() => void openGuide()}>Turn on the shortcut</button>
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
    <div className="state empty-picker">
      <div className="state__vibe"><Buddy mood="wave" size={58} follow label="Vibe" /></div>
      <div className="big">Ready when you are.</div>
      <div className="sub">
        Let’s make that code click. Select a snippet and press {shortcut}, or paste it below.
      </div>
      {grantNote ? <div className="access-note" role="status">{grantNote}</div> : null}
      <div className="empty-actions">
        <button className="btn" disabled={picking} onClick={() => window.unvibe.useClipboard({ level })}>
          Explain my clipboard
        </button>
        <button className="btn ghost" disabled={picking} onClick={() => void chooseFile()}>
          {picking ? 'Opening…' : 'Choose a file…'}
        </button>
      </div>
      <details className="empty-more">
        <summary>Review project changes</summary>
        <div className="empty-actions">
        <button className="btn ghost" disabled={picking} onClick={() => void runPro('diff')}>
          Explain git diff · Pro
        </button>
        <button className="btn ghost" disabled={picking} onClick={() => void runPro('brief')}>
          Change brief · Pro
        </button>
        <button className="btn ghost" disabled={picking} onClick={() => void runPro('compare')}>
          Since last understood · Pro
        </button>
        </div>
      </details>
      <label className="paste-label" htmlFor="paste-code">
        Or paste code
      </label>
      <textarea
        id="paste-code"
        className="paste-box"
        rows={5}
        placeholder="Paste a function, diff, or snippet…"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
      />
      <button
        className="btn"
        disabled={!paste.trim()}
        onClick={() => window.unvibe.usePaste({ text: paste, level })}
      >
        Explain pasted code
      </button>
      {hint ? <div className="sub empty-hint">{hint}</div> : null}
    </div>
  );
}

function patchTab(tabs: TabState[], tabId: string, patch: Partial<TabState>): TabState[] {
  return tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t));
}

function archiveCurrent(tab: TabState): HistoryEntry[] {
  if (!tab.text.trim()) return tab.history;
  return [
    ...tab.history,
    {
      id: `${tab.id}-${Date.now()}`,
      text: tab.text,
      meta: tab.meta,
      level: tab.level,
      at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    },
  ];
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

function applyTheme(preference: 'system' | 'light' | 'dark') {
  const dark = preference === 'dark'
    || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

// v2 key: paper became the default look, matching the companion window.
const PANEL_THEME_KEY = 'unvibe.panelTheme2';

function Widget() {
  const [tabs, setTabs] = useState<TabState[]>([newTab('1', 'Review')]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [collapsed, setCollapsed] = useState(false);
  // Panel look is a per-device preference: paper (default) or an ink terminal.
  const [panelTheme, setPanelTheme] = useState<'dark' | 'light'>(() => {
    try { return window.localStorage.getItem(PANEL_THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const [away, setAway] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.panel = panelTheme;
    try { window.localStorage.setItem(PANEL_THEME_KEY, panelTheme); } catch { /* storage blocked */ }
  }, [panelTheme]);
  // Clicking back into your editor turns the panel see-through instead of hiding it.
  useEffect(() => {
    const onBlur = () => setAway(true);
    const onFocus = () => setAway(false);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); };
  }, []);
  const [shortcut, setShortcut] = useState(reviewKeyHint);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [teachOpen, setTeachOpen] = useState(false);
  const [proGate, setProGate] = useState(false);
  // While checkout is closed the panel says "Pro opens soon" instead of offering a purchase.
  const [proOpen, setProOpen] = useState(false);
  useEffect(() => { void window.unvibe.billingStatus().then((status) => setProOpen(status.paymentsOpen)); }, []);
  const [activeTool, setActiveTool] = useState<'explain' | 'depth' | 'quiz' | 'ask'>('explain');
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeTabId);
  tabsRef.current = tabs;
  activeRef.current = activeTabId;

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!;
  const outOfExplanations = usage ? usage.remaining <= 0 : false;
  const offer = usage ? limitOfferCopy(usage.plan, usage, proOpen) : null;
  const sessionPaused = Boolean(outOfExplanations && offer?.primaryKind === 'survey');
  const [revealedText, setRevealedText] = useState('');
  const [features, setFeatures] = useState({ whyExists: true, teachBack: true, voice: false, changeBrief: true });
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const refreshUsage = () => {
      void window.unvibe.usageGet().then((result) => {
        const r = result as { ok?: boolean; data?: UsageState };
        if (!r.ok || !r.data) return;
        setUsage(r.data);
      });
    };
    void window.unvibe.getSettings().then((st) => {
      const s = st as { theme?: 'system' | 'light' | 'dark'; features?: typeof features; soundEffects?: boolean; soundVolume?: number; soundStyle?: 'soft' | 'pixel' };
      applyTheme(s.theme ?? 'system');
      configureTones({ enabled: s.soundEffects ?? true, volume: s.soundVolume ?? 0.3, style: s.soundStyle ?? 'soft' });
      if (s.features) setFeatures((prev) => ({ ...prev, ...s.features }));
    });
    refreshUsage();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => {
      void window.unvibe.getSettings().then((st) => {
        const s = st as { theme?: 'system' | 'light' | 'dark' };
        if ((s.theme ?? 'system') === 'system') applyTheme('system');
      });
    };
    mq.addEventListener('change', onScheme);
    return () => mq.removeEventListener('change', onScheme);
  }, []);

  // Keep typography in proportion when someone makes the compact panel smaller.
  // The native window owns size; the renderer only exposes a bounded visual scale.
  useEffect(() => {
    const updateScale = () => {
      const scale = Math.max(0.78, Math.min(1, Math.min(window.innerWidth / 560, window.innerHeight / 640)));
      document.documentElement.style.setProperty('--widget-scale', scale.toFixed(3));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.unvibe.onReviewEvent((raw) => {
      const ev = raw as WidgetEvent;
      const tabId = ev.tabId;
      if (ev.type === 'usage') {
        setUsage((current) => ({
          used: ev.used,
          limit: ev.limit,
          remaining: ev.remaining,
          resetsAt: ev.resetsAt,
          plan: ev.plan,
          selections: current?.selections,
        }));
      }
      if (ev.type === 'error' && 'code' in ev && ev.code === 'pro_required') {
        setProGate(true);
      }
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        if (!tab) return prev;

        switch (ev.type) {
          case 'init': {
            const history = archiveCurrent(tab);
            return patchTab(prev, tabId, {
              history,
              meta: {
                sourceApp: ev.sourceApp,
                file: ev.file,
                lines: ev.lines,
                language: ev.language,
                preview: ev.preview,
              },
              text: '',
              quiz: null,
              error: '',
              mock: false,
              phase: ev.consentProvider ? 'aiConsent' : ev.hasCode ? (ev.confirm ? 'confirm' : 'ready') : 'empty',
              consentProvider: ev.consentProvider ?? null,
              confirmAfterConsent: Boolean(ev.confirm),
              confirmAfterAgree: Boolean(ev.confirm) && tab.agreedJustNow,
              agreedJustNow: false,
              providerName: ev.providerName,
              level: ev.level,
            });
          }
          case 'understood':
            return prev;
          case 'status':
            playTone('think');
            return patchTab(prev, tabId, { text: '', phase: 'streaming', quiz: ev.resetQuiz === false ? tab.quiz : null, quizHidden: false });
          case 'consentNeeded':
            return patchTab(prev, tabId, { phase: 'aiConsent', consentProvider: ev.provider });
          case 'consent':
            return patchTab(prev, tabId, { findings: ev.findings ?? [], phase: 'consent' });
          case 'blocked':
            return patchTab(prev, tabId, { findings: ev.findings ?? [], phase: 'blocked' });
          case 'token':
            return prev.map((t) =>
              t.id === tabId
                ? { ...t, text: t.text + (ev.text ?? ''), phase: 'streaming' as Phase }
                : t,
            );
          case 'done':
            playTone('done');
            return patchTab(prev, tabId, { mock: Boolean(ev.mock), phase: 'done' });
          case 'error':
            return patchTab(prev, tabId, {
              error: ev.message ?? 'Something went wrong.',
              phase: 'error',
              quiz: tab.quiz && tab.quiz.phase !== 'graded' ? null : tab.quiz,
            });
          case 'quizError':
            return patchTab(prev, tabId, { quiz: { phase: 'failed', error: ev.message } });
          // understood: no UI reset — Got it collapses separately
          case 'cancelled':
            return patchTab(prev, tabId, { text: '', quiz: null, phase: 'ready' });
          case 'question':
            return patchTab(prev, tabId, {
              quiz: {
                phase: 'answering',
                question: ev.question,
                options: ev.options,
                conceptLabel: ev.conceptLabel,
                index: ev.index,
                total: ev.total,
                mode: ev.mode,
              },
            });
          case 'graded':
            playTone(ev.correct ? 'correct' : 'wrong');
            return patchTab(prev, tabId, {
              quiz: tab.quiz
                ? {
                    ...tab.quiz,
                    phase: 'graded',
                    correct: ev.correct,
                    answerIndex: ev.answerIndex,
                    rationale: ev.rationale,
                    hasMissed: ev.hasMissed,
                  }
                : tab.quiz,
            });
          default:
            return prev;
        }
      });
    });
    window.unvibe.onAutocollapse((v) => {
      setCollapsed(v);
      window.unvibe.collapse(v);
    });
    window.unvibe.widgetReady();
    window.unvibe.appInfo().then((i) => setShortcut(prettyAccel(i.shortcut)));
  }, []);

  // ChatGPT-style progressive reveal: catch displayed text up to the streamed buffer.
  useEffect(() => {
    if (active.phase !== 'streaming' && active.phase !== 'done') {
      setRevealedText('');
      return;
    }
    if (active.text.length === 0) {
      setRevealedText('');
      return;
    }
    let cancelled = false;
    let frame = 0;
    const tick = () => {
      if (cancelled) return;
      setRevealedText((prev) => {
        if (prev.length >= active.text.length) return active.text;
        const remaining = active.text.length - prev.length;
        const step = Math.min(remaining, Math.max(2, Math.ceil(remaining / 10)));
        const next = active.text.slice(0, prev.length + step);
        if (next.length < active.text.length) frame = requestAnimationFrame(tick);
        return next;
      });
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [active.text, active.phase, activeTabId]);

  // Autoscroll while streaming on the active tab.
  useEffect(() => {
    if (active.phase === 'streaming' && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [revealedText, active.phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'w') window.unvibe.closeWidget();
      else if (e.key === 'Escape') toggleCollapse();
      else if (mod && e.key >= '1' && e.key <= '5') pick(LEVELS[Number(e.key) - 1]!.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, activeTabId]);

  const request = (opts: Record<string, unknown>) => {
    if (outOfExplanations) {
      setTabs((prev) => patchTab(prev, activeRef.current, {
        phase: 'error',
        error: offer
          ? offer.body
          : 'You have reached your monthly explanation limit. Open Plan to upgrade.',
      }));
      return;
    }
    window.unvibe.request({ level: active.level, ...opts });
  };

  const openQuiz = (another = false) => {
    setActiveTool('quiz');
    if (!another && active.quiz && active.quiz.phase !== 'failed') {
      setTabs((prev) => patchTab(prev, activeTabId, { quizHidden: false }));
      return;
    }
    setTabs((prev) => patchTab(prev, activeTabId, { quiz: { phase: 'loading' }, quizHidden: false }));
    window.unvibe.testMe();
  };

  const pick = (l: ExplanationLevel) => {
    if (outOfExplanations) return;
    setTabs((prev) => patchTab(prev, activeRef.current, { level: l }));
    const tab = tabsRef.current.find((t) => t.id === activeRef.current);
    if (tab?.phase === 'done') window.unvibe.request({ level: l });
  };

  const toggleCollapse = () => {
    setCollapsed((c) => {
      window.unvibe.collapse(!c);
      return !c;
    });
  };

  const selectTab = (tabId: string) => {
    setActiveTabId(tabId);
    window.unvibe.setActiveTab(tabId);
  };

  const addTab = () => {
    const id = String(Date.now());
    const label = `Review ${tabs.length + 1}`;
    setTabs((prev) => [...prev, newTab(id, label)]);
    setActiveTabId(id);
    window.unvibe.addTab(id);
  };

  const closeTab = (tabId: string, e: MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      window.unvibe.closeWidget();
      return;
    }
    const next = tabs.filter((t) => t.id !== tabId);
    const nextActive = activeTabId === tabId ? next[next.length - 1]!.id : activeTabId;
    setTabs(next);
    setActiveTabId(nextActive);
    if (nextActive !== activeTabId) window.unvibe.setActiveTab(nextActive);
    window.unvibe.closeTab(tabId);
  };

  const phase = active.phase;
  const phaseLabel = phase === 'boot' ? 'capturing' : phase === 'ready' ? 'reading' : phase === 'aiConsent' || phase === 'confirm' ? 'waiting for you' : phase === 'streaming' ? 'explaining' : phase === 'done' ? 'ready to learn' : phase === 'empty' ? 'waiting' : phase;
  const src = active.meta.lines ? (
    <span className="src">
      <b>{active.meta.lines} lines</b>
      {active.meta.language && active.meta.language !== 'plaintext' ? ` · ${active.meta.language}` : ''}
      {active.meta.sourceApp ? ` · from ${active.meta.sourceApp}` : ''}
    </span>
  ) : (
    <span className="src">
      <b>Ready</b>
    </span>
  );

  const showText = phase === 'streaming' || phase === 'done' ? revealedText : active.text;
  const stillTyping = phase === 'streaming' || (phase === 'done' && revealedText.length < active.text.length);

  const askWhy = () => {
    void window.unvibe.lookupOrigin().then((raw) => {
      const result = raw as {
        ok?: boolean;
        error?: string;
        report?: { facts: Array<{ label: string; value: string }>; inference: string };
      };
      setTabs((prev) => patchTab(prev, activeTabId, {
        originOpen: true,
        originError: result?.ok ? '' : (result?.error ?? 'Unvibe could not find documented history for this code.'),
        originFacts: result?.report?.facts ?? [],
        originInference: result?.report?.inference ?? '',
      }));
    });
  };

  return (
    <div className={`card card--${phase}${active.quiz && !active.quizHidden ? ' card--quiz' : ''}${away ? ' card--away' : ''}`} aria-label="Unvibe">
      {!collapsed ? <ResizeGrips /> : null}
      <div className="head">
        <span className="head__mark head__mark--vibe" aria-hidden="true">
          <Buddy mood={phase === 'streaming' ? (active.text ? 'reading' : 'thinking') : phase === 'error' || phase === 'blocked' ? 'confused' : 'idle'} size={26} label="Vibe" />
        </span>
        <div className="head__context">
          <span className="head__product">Unvibe</span>
          {src}
        </div>
        <span className={`head__status head__status--${phase}`} role="status"><i aria-hidden="true" />{phaseLabel}</span>
        <div className="head__actions">
          {usage && (
            <span className="head__usage" title={`Resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`}>
              {usage.remaining} left
            </span>
          )}
          <button
            className="head__theme"
            aria-label={panelTheme === 'dark' ? 'Switch panel to light mode' : 'Switch panel to dark mode'}
            title={panelTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={() => setPanelTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {panelTheme === 'dark' ? '☀' : '☾'}
          </button>
          <button aria-label="Open saved explanations" title="Saved explanations" onClick={() => window.unvibe.openStudy()}>
            Saved
          </button>
          <button className="head__glyph" aria-label={collapsed ? 'Expand panel' : 'Collapse panel'} aria-expanded={!collapsed} title={collapsed ? 'Expand' : 'Collapse'} onClick={toggleCollapse}>
            <span aria-hidden="true">{collapsed ? '▾' : '▴'}</span>
          </button>
          <button className="head__glyph" aria-label="Close panel" title="Close" onClick={() => window.unvibe.closeWidget()}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="widget-workspace">
          <aside className="widget-tools" aria-label="Review tools">
            <button className={`tool--explain${activeTool === 'explain' ? ' on' : ''}`} type="button" title="Explanation" onClick={() => {
              setActiveTool('explain');
              document.querySelector('.body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}><ToolIcon name="explain" /><b>Explain</b></button>
            <button className={`tool--depth${activeTool === 'depth' ? ' on' : ''}`} type="button" title="Difficulty" onClick={() => {
              setActiveTool('depth');
              document.querySelector('.levels')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}><ToolIcon name="depth" /><b>Depth</b></button>
            <button className={`tool--quiz${activeTool === 'quiz' ? ' on' : ''}`} type="button" title="Quiz" disabled={phase !== 'done' || stillTyping} onClick={() => openQuiz()}><ToolIcon name="quiz" /><b>Quiz</b></button>
            <button className={`tool--ask${activeTool === 'ask' ? ' on' : ''}`} type="button" title="Ask a follow-up" onClick={() => {
              setActiveTool('ask');
              requestAnimationFrame(() => (document.querySelector('.askrow input') as HTMLInputElement | null)?.focus());
            }}><ToolIcon name="ask" /><b>Ask</b></button>
            {features.whyExists ? (
              <button type="button" className="tool--why" title="Why does this exist" disabled={phase !== 'done' || stillTyping} onClick={askWhy}><ToolIcon name="why" /><b>Why</b></button>
            ) : null}
            {features.teachBack ? (
              <button type="button" className={`tool--teach${teachOpen ? ' on' : ''}`} title="Teach it back" aria-expanded={teachOpen} disabled={phase !== 'done' || stillTyping} onClick={() => setTeachOpen((open) => !open)}><ToolIcon name="teach" /><b>Teach</b></button>
            ) : null}
            <div className="widget-tools__spacer" />
            <button type="button" className="tool--saved" title="Open saved learning" onClick={() => window.unvibe.openStudy()}><ToolIcon name="library" /><b>Saved</b></button>
            {usage && (
              <div className="widget-tools__usage" title={`${usage.used} of ${usage.limit} explanations used this month. Resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`}>
                <span>Available</span>
                <UsageRings ai={{ used: usage.used, limit: usage.limit, remaining: usage.remaining }} selections={usage.selections} size={26} tiny />
              </div>
            )}
          </aside>
          <section className="widget-main">

      {!collapsed && !sessionPaused && (
        <div className="tabs" role="group" aria-label="Review tabs">
          {tabs.map((t) => (
            <div key={t.id} className={`tab${t.id === activeTabId ? ' on' : ''}`}>
              <button
                type="button"
                aria-pressed={t.id === activeTabId}
                className="tab__label"
                onClick={() => selectTab(t.id)}
              >
                {t.label}
              </button>
              <button
                type="button"
                className="tab__x"
                aria-label={`Close ${t.label}`}
                title={`Close ${t.label}`}
                onClick={(e) => closeTab(t.id, e)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          ))}
          <button type="button" className="tab-add" aria-label="Add tab" title="Add another review tab" onClick={addTab}>
            +
          </button>
        </div>
      )}

      {!collapsed && sessionPaused && offer ? (
        <div className="state state--limit state--pause" role="status">
          <div className="big">{offer.title}</div>
          <div className="sub">{offer.body}</div>
          <div className="pause-actions">
            <button className="btn" onClick={() => void window.unvibe.openUrl(BETA_SURVEY_URL)}>
              {offer.primary}
            </button>
            {offer.showPlan ? (
              <button className="btn ghost" onClick={() => window.unvibe.openPlan()}>
                {proOpen ? 'Buy a subscription' : 'Pro opens soon'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!collapsed && !sessionPaused && (phase === 'ready' || phase === 'streaming' || phase === 'done' || phase === 'boot') && (
        <div className="levels" role="group" aria-label="Explanation depth">
          <span className="levels__label">Depth</span>
          {LEVELS.map((l) => {
            const expertLocked = l.id === 'expert' && usage?.plan !== 'pro' && usage?.plan !== 'teams' && usage?.plan !== 'full';
            return (
              <button
                key={l.id}
                data-level={l.id}
                className={`lvl${l.id === active.level ? ' on' : ''}${expertLocked ? ' lvl--locked' : ''}`}
                disabled={outOfExplanations || expertLocked}
                title={expertLocked ? 'Expert explanations are included with Unvibe Pro' : `Explain at ${l.label} depth`}
                aria-label={expertLocked ? `${l.label}, included with Unvibe Pro` : undefined}
                onClick={() => {
                  if (expertLocked) {
                    setProGate(true);
                    setTabs((prev) => patchTab(prev, activeRef.current, {
                      phase: 'error',
                      error: 'Expert explanations are included with Unvibe Pro. Pro connects explanations across files and project history so you can understand more than the selected code.',
                    }));
                    return;
                  }
                  setProGate(false);
                  pick(l.id);
                }}
              >
                {l.label}
                {expertLocked ? <span className="lvl__pro" aria-hidden="true">Pro</span> : null}
              </button>
            );
          })}
        </div>
      )}

      {!collapsed && !sessionPaused && (
        <>
          {phase === 'boot' && (
            <div className="state" role="status">
              <div className="sub">Capturing selection…</div>
            </div>
          )}

          {phase === 'aiConsent' && active.consentProvider && (
            <div className="state">
              <ConsentForm
                key={active.consentProvider}
                provider={active.consentProvider}
                buttonClass="btn"
                onAgreed={() => {
                  // An explanation already on screen (a follow-up was refused): back to it, ask again from there.
                  // A link capture: the confirm sheet, so the code is seen before it's sent.
                  // Captured code that waited on this computer: explain it now. Nothing captured: a
                  // clipboard explain asked for just before agreeing is read now and shown on the confirm
                  // sheet (QA F1, Security U-F1-L2), otherwise the picker.
                  const next: Phase | null = active.text ? 'done' : active.confirmAfterConsent ? 'confirm' : active.meta.lines ? null : 'empty';
                  if (next === 'empty') {
                    setTabs((prev) => patchTab(prev, activeRef.current, { phase: 'boot', consentProvider: null, agreedJustNow: true }));
                    void window.unvibe.explainAfterConsent().then((result) => {
                      if (!result.explained) setTabs((prev) => patchTab(prev, activeRef.current, { phase: 'empty', agreedJustNow: false }));
                    });
                  } else if (next) setTabs((prev) => patchTab(prev, activeRef.current, { phase: next, consentProvider: null }));
                  else request({});
                }}
                onCancel={() => window.unvibe.closeWidget()}
              />
            </div>
          )}

          {phase === 'ready' && (
            <div className="state ready-state">
              <div className="container-progress" aria-label="Explanation progress"><span className="on">1 · captured</span><span className="on">2 · filtered</span><span>3 · explaining</span></div>
              <div className="big">Reading your code in context…</div>
              <div className="detected">
                <span>{active.meta.language && active.meta.language !== 'plaintext' ? active.meta.language : 'Code selection'}</span>
                <span>{active.meta.lines ?? 0} lines</span>
                {active.meta.sourceApp && <span>{active.meta.sourceApp}</span>}
              </div>
              <div className="sub">Parsing your selection and generating the explanation.</div>
            </div>
          )}

          {phase === 'confirm' && (
            <div className="state ready-state" role="alertdialog" aria-labelledby="confirm-title">
              <div className="big" id="confirm-title">Explain this code?</div>
              <div className="detected">
                <span>{active.meta.language && active.meta.language !== 'plaintext' ? active.meta.language : 'Code selection'}</span>
                <span>{active.meta.lines ?? 0} lines</span>
                {active.meta.sourceApp && <span>{active.meta.sourceApp}</span>}
              </div>
              {active.meta.preview ? (
                <section className="code-context" aria-label="Code from your clipboard">
                  <pre tabIndex={0}><code>{active.meta.preview}</code></pre>
                </section>
              ) : null}
              <div className="sub">
                {active.confirmAfterAgree
                  ? 'This is what is on your clipboard now.'
                  : 'Your editor or a link asked Unvibe to explain what is on your clipboard.'}{' '}
                Nothing has been sent yet. Explain sends it to {active.providerName}.
              </div>
              <button className="btn" onClick={() => request({})}>
                Explain
              </button>
              <button className="btn ghost" onClick={() => window.unvibe.closeWidget()}>
                Cancel
              </button>
            </div>
          )}

          {phase === 'empty' && <EmptyPicker shortcut={shortcut} level={active.level} />}

          {phase === 'consent' && (
            <div className="state" role="alert">
              <div className="big">Possible secret detected</div>
              <div className="findings">
                {active.findings.map((f, i) => (
                  <div key={i}>
                    {f.rule} · {f.file} line {f.line} · {f.masked}
                  </div>
                ))}
              </div>
              <div className="sub">Nothing has been sent. Send anyway, or close and clean the selection.</div>
              <button className="btn" onClick={() => request({ consented: true })}>
                Send anyway
              </button>
              <button className="btn ghost" onClick={() => window.unvibe.closeWidget()}>
                Cancel
              </button>
            </div>
          )}

          {phase === 'blocked' && (
            <div className="state" role="alert">
              <div className="big">Blocked: credential detected</div>
              <div className="findings">
                {active.findings.map((f, i) => (
                  <div key={i}>
                    {f.rule} · {f.file} line {f.line} · {f.masked}
                  </div>
                ))}
              </div>
              <div className="sub">Nothing was sent. Remove the secret from the selection or your question and try again.</div>
            </div>
          )}

          {phase === 'error' && (
            <div className={`state${outOfExplanations ? ' state--limit' : ''}`} role="alert">
              <div className="big">
                {outOfExplanations && offer ? offer.title : proGate ? 'Pro feature' : "Couldn't explain that"}
              </div>
              <div className="sub">{active.error}</div>
              {proGate && !outOfExplanations && !proOpen ? <div className="sub">{freePlanLine(usage)}</div> : null}
              {outOfExplanations || proGate ? (
                <>
                  <button className="btn" onClick={() => {
                    if (offer?.primaryKind === 'survey') void window.unvibe.openUrl(BETA_SURVEY_URL);
                    else window.unvibe.openPlan();
                  }}>
                    {outOfExplanations && offer ? offer.primary : proOpen ? 'Upgrade to Pro' : 'Pro opens soon'}
                  </button>
                  {outOfExplanations && offer?.showPlan && offer.primaryKind === 'survey' ? (
                    <button className="btn ghost" onClick={() => window.unvibe.openPlan()}>
                      {proOpen ? 'Buy a subscription' : 'Pro opens soon'}
                    </button>
                  ) : (
                    <button className="btn ghost" onClick={() => { setProGate(false); window.unvibe.openStudy(); }}>
                      {outOfExplanations ? 'Return to saved learning' : 'Maybe later'}
                    </button>
                  )}
                </>
              ) : (
                <button className="btn" onClick={() => request({})}>
                  Retry
                </button>
              )}
            </div>
          )}

          {(phase === 'streaming' || phase === 'done') && (
            <div className="stage">
            <div className="body" ref={bodyRef} tabIndex={0} role="region" aria-label="Explanation" aria-live="polite" aria-atomic="false">
              {active.meta.preview ? (
                <section className="code-context" aria-label="Selected code context">
                  <div className="code-context__head">
                    <span>Selected code</span>
                    <span>{active.meta.file || active.meta.language || 'Local selection'}</span>
                  </div>
                  <pre tabIndex={0}><code>{active.meta.preview}</code></pre>
                </section>
              ) : null}
              {showText
                ? renderRich(showText, stillTyping)
                : (
                  <ThinkingCard hasCode={Boolean(active.meta.preview)} />
                )}
            </div>
            {active.quiz && !active.quizHidden && (
              <aside className="quiz-rail" aria-label="Test me">
                {active.quiz.phase === 'loading' && (
                  <div className="quiz-rail__wait" role="status">
                    <span>Writing a question…</span>
                    <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
                  </div>
                )}
                {active.quiz.phase === 'failed' && (
                  <div className="quiz" role="alert">
                    <div className="quiz__kicker">Test me</div>
                    <div className="quiz__why">{active.quiz.error}</div>
                    <div className="quiz__actions">
                      <button
                        className="btn"
                        onClick={() => openQuiz()}
                      >
                        Try again
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => setTabs((prev) => patchTab(prev, activeTabId, { quizHidden: true }))}
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                )}
                {active.quiz.phase !== 'loading' && active.quiz.phase !== 'failed' && (
                  <div className="quiz">
                    <div className="quiz__kicker">
                      Test me{(active.quiz.index ?? 1) > 1 ? ` · ${active.quiz.index} of ${active.quiz.total}` : ''}
                    </div>
                    {active.quiz.mode !== 'quick-check' && active.quiz.mode && (
                      <div className="quiz__concept">{active.quiz.mode === 'scenario' ? 'Prove it' : 'Recall'}</div>
                    )}
                    {active.quiz.conceptLabel && (
                      <div className="quiz__concept">{active.quiz.conceptLabel}</div>
                    )}
                    <div className="quiz__q">{active.quiz.question}</div>
                    <div className="quiz__opts">
                      {active.quiz.options?.map((o, i) => {
                        const graded = active.quiz!.phase === 'graded';
                        const cls = graded
                          ? i === active.quiz!.answerIndex
                            ? 'opt right'
                            : i === active.quiz!.choice
                              ? 'opt wrong'
                              : 'opt'
                          : i === active.quiz!.choice
                            ? 'opt sel'
                            : 'opt';
                        return (
                          <button
                            key={i}
                            className={cls}
                            disabled={active.quiz!.phase !== 'answering'}
                            onClick={() =>
                              setTabs((prev) =>
                                patchTab(prev, activeTabId, {
                                  quiz: { ...active.quiz!, choice: i },
                                }),
                              )
                            }
                          >
                            <em>{String.fromCharCode(65 + i)}</em>
                            <span>{o}</span>
                          </button>
                        );
                      })}
                    </div>
                    {active.quiz.phase === 'graded' ? (
                      <>
                        <div className={`verdict ${active.quiz.correct ? 'ok' : 'no'}`} role="status">
                          {active.quiz.correct
                            ? active.quiz.hasMissed ? 'Correct. Earlier misses are saved to revisit.' : 'Correct. That one is understood.'
                            : 'Not quite. Saved to revisit.'}
                        </div>
                        {active.quiz.rationale && (
                          <div className="quiz__why">{active.quiz.rationale}</div>
                        )}
                        {(active.quiz.index ?? 1) >= (active.quiz.total ?? 3) && (
                          <div className="quiz__why">
                            {active.quiz.hasMissed
                              ? "That's all three for this code. Missed ones come back in your review queue."
                              : 'All three right.'}
                          </div>
                        )}
                        <div className="quiz__actions">
                          {(active.quiz.index ?? 1) < (active.quiz.total ?? 3) && (
                            <button className="btn" onClick={() => openQuiz(true)}>
                              Another question
                            </button>
                          )}
                          <button
                            className="btn ghost"
                            onClick={() => setTabs((prev) => patchTab(prev, activeTabId, { quizHidden: true }))}
                          >
                            Hide question
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="quiz__actions">
                        <button
                          className="btn"
                          disabled={active.quiz.choice === undefined || active.quiz.phase === 'grading'}
                          onClick={() => {
                            window.unvibe.answer(active.quiz!.choice!);
                            setTabs((prev) =>
                              patchTab(prev, activeTabId, {
                                quiz: { ...active.quiz!, phase: 'grading' },
                              }),
                            );
                          }}
                        >
                          {active.quiz.phase === 'grading' ? 'Checking…' : 'Check'}
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() => setTabs((prev) => patchTab(prev, activeTabId, { quizHidden: true }))}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </aside>
            )}
            </div>
          )}

          {outOfExplanations && offer && offer.primaryKind !== 'survey' && (phase === 'done' || phase === 'streaming') && (
            <div className="limit-strip" role="status">
              <div>
                <strong>{offer.title}</strong>
                <p>{offer.body}</p>
              </div>
              <button type="button" className="btn" onClick={() => window.unvibe.openPlan()}>
                {offer.primary}
              </button>
            </div>
          )}

          {(phase === 'streaming' || phase === 'done') && (
            <div className="foot">
              <div className="chips">
                {phase === 'streaming' && (
                  <button className="chip" onClick={() => window.unvibe.cancel()}>
                    Stop generating
                  </button>
                )}
                <button
                  className="chip chip--ok"
                  disabled={stillTyping}
                  onClick={() => {
                    setBuddyMood('celebrate');
                    window.unvibe.gotIt();
                    toggleCollapse();
                  }}
                >
                  Understand ✓
                </button>
                <button
                  className="chip chip--diff"
                  disabled={stillTyping}
                  onClick={() => request({ variant: 'different' })}
                >
                  Explain differently
                </button>
                <button
                  className="chip chip--test"
                  disabled={stillTyping}
                  onClick={() => openQuiz()}
                >
                  Test me
                </button>

                {active.mock && (
                  <span className="mock-note">mock AI. Set ANTHROPIC_API_KEY for real explanations</span>
                )}
                {!active.mock && phase === 'done' && <span className="local-save-note">saved on this {deviceName}</span>}
              </div>
              {active.originOpen ? (
                <div className="origin-panel" role="region" aria-label="Why this exists">
                  <div className="ask-sandbox__label">Source facts</div>
                  {active.originError ? <p className="sub">{active.originError}</p> : null}
                  {active.originFacts.map((fact) => (
                    <p key={fact.label}><strong>{fact.label}.</strong> {fact.value}</p>
                  ))}
                  <p className="origin-inference">{active.originInference || 'No documented rationale found.'}</p>
                </div>
              ) : null}
              {features.teachBack && phase === 'done' && teachOpen ? (
                <div className="teach-panel" role="region" aria-label="Teach it back">
                  <div className="ask-sandbox__label">Teach it back</div>
                  <textarea
                    className="teach-box"
                    rows={3}
                    placeholder="Explain this change in your own words."
                    value={active.teachAnswer}
                    onChange={(e) => setTabs((prev) => patchTab(prev, activeTabId, { teachAnswer: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!active.teachAnswer.trim()}
                    onClick={() => {
                      void window.unvibe.gradeTeachBack({ answer: active.teachAnswer }).then((raw) => {
                        const result = raw as {
                          ok?: boolean;
                          result?: { checks: Array<{ topic: string; mark: 'covered' | 'partial' | 'missed' }>; evidence: string; note: string };
                        };
                        if (!result?.result) return;
                        setTabs((prev) => patchTab(prev, activeTabId, {
                          teachChecks: result.result!.checks,
                          teachEvidence: result.result!.evidence,
                          teachNote: result.result!.note,
                        }));
                      });
                    }}
                  >
                    Check understanding
                  </button>
                  {active.teachEvidence ? (
                    <div className="teach-result">
                      {active.teachChecks.map((check) => (
                        <p key={check.topic}>{check.mark === 'covered' ? '✓' : check.mark === 'partial' ? '△' : '✕'} {check.topic}</p>
                      ))}
                      <p>Understanding evidence: {active.teachEvidence}</p>
                      <p className="sub">{active.teachNote}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="ask-sandbox">
                <div className="ask-sandbox__label">Ask a follow-up</div>
                <div className="askrow">
                  <input
                    placeholder="Why does this exist? What breaks if I remove it?"
                    value={active.ask}
                    maxLength={4000}
                    disabled={stillTyping}
                    aria-label="Follow-up question"
                    onChange={(e) =>
                      setTabs((prev) => patchTab(prev, activeTabId, { ask: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && active.ask.trim()) {
                        request({ question: active.ask.trim() });
                        setTabs((prev) => patchTab(prev, activeTabId, { ask: '' }));
                      }
                    }}
                  />
                  {features.voice ? (
                    <button
                      type="button"
                      className={`btn ghost${listening ? ' rec' : ''}`}
                      aria-pressed={listening}
                      title={isWindows ? 'Ask out loud with Windows voice typing' : 'Ask out loud with Mac Dictation'}
                      onClick={() => {
                        setListening((v) => !v);
                        (document.querySelector('.askrow input') as HTMLInputElement | null)?.focus();
                      }}
                    >
                      🎙 Speak
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ask"
                    aria-label="Ask"
                    disabled={stillTyping || !active.ask.trim()}
                    onClick={() => {
                      if (!active.ask.trim()) return;
                      request({ question: active.ask.trim() });
                      setTabs((prev) => patchTab(prev, activeTabId, { ask: '' }));
                    }}
                  >
                    ↑
                  </button>
                </div>
                {listening ? (
                  <p className="voice-note" role="note">{voiceHowTo}{!isWindows ? ' Nothing? Turn on Dictation in System Settings, Keyboard.' : ''}</p>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Widget />);
