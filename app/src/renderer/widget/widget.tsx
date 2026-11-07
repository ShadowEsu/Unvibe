import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { WidgetEvent } from '../../main/review';
import type { ExplanationLevel } from '../../core/protocol';
import type { SecretFinding } from '../../core/secretFilter';
import { Buddy, setBuddyMood } from '../shared/buddy';
import { configureTones, playTone } from '../shared/tones';
import { renderRich } from '../shared/richText';
import { ShortAnswer } from '../shared/shortAnswer';
import { linesLabel } from '../../core/linesLabel';
import { BETA_SURVEY_URL, limitOfferCopy } from '../shared/limitOffer';
import { freePlanLine } from '../shared/planStatus';
import { prettyShortcut } from '../shared/prettyShortcut';
import { deviceName, isWindows, reviewKeyHint, voiceHowTo } from '../shared/platform';
import { languageName, selectionSource, selectionTitle } from '../shared/languageName';
import { MenuButton, TabStrip, panelMenuItems } from './panelMenu';
import { LEVELS, LevelChip } from './levelChip';
import { CodeBlock, PanelActions, PanelToast, SQUASH_MS, TOAST_EXIT_MS, TOAST_MS } from './panelBody';
import { QuizActions, QuizCard, type Quiz } from './panelQuiz';
import { useRevealedText } from './reveal';
import { trackWindowAway } from '../shared/windowAway';
import { PasteTarget } from '../shared/pasteTarget';
import { ShortcutGuide, turnOnShortcut } from '../shared/shortcutGuide';
import { ConsentForm } from '../shared/consentForm';
import { CONSENT_PROVIDERS, type ConsentProvider } from '../../core/consent';
import type { PmfDraft } from '../../core/pmf';
import { PmfCard, type PmfCardModel } from './pmfCard';
import '../shared/tokens.css';

/**
 * `aiConsent`: the first-send agreement (sending code to the provider, Terms, 18+);
 * `confirm`: a link started this review, Explain sends it; `consent`: a secret was found.
 *
 * Where each phase goes in overlay B (Design b-refined SPEC + b-states mocks). Every phase keeps the 50 pt
 * header and the four bottom tabs; the body is the Explain tab unless noted, with main's strings:
 * - boot: "Capturing selection…" status line.
 * - ready: depth + code row, then "Reading your code in context…" with its three progress steps.
 * - aiConsent: the consent form (b-consent), Continue primary, Not now quiet.
 * - confirm: "Explain this code?" sheet with the clipboard preview; Explain primary, Cancel quiet.
 * - empty: the picker (b-empty): "Ready when you are." with keycaps, Explain my clipboard, Choose a file…,
 *   Review project changes (Pro tags) and the paste box. A Mac without Accessibility keeps the paste-first picker.
 * - consent: "Possible secret detected" (b-secret): amber badge, findings card, Cancel primary, Send anyway quiet.
 * - blocked: "Blocked: credential detected" (b-blocked): amber lock badge, findings card, no action.
 * - streaming: depth + code row; Vibe's three thinking steps until words arrive (b-thinking), then the answer
 *   (b-streaming). The footer holds only "Stop generating".
 * - done: the answer with code-word chips, Understand · Save · Explain differently, the Ask field.
 * - error: "Couldn't explain that" (b-error): amber badge, the message, Retry (or the limit / Pro offers).
 * - limit pause: the survey offer replaces the body; the tabs stay.
 * Test me (quiz loading/answering/graded/failed) is the Test me tab (b-graded); follow-ups, Why and Teach it back
 * are the Ask tab; pinned and recent lessons are the Saved tab.
 */
type Phase = 'boot' | 'ready' | 'aiConsent' | 'confirm' | 'empty' | 'consent' | 'blocked' | 'streaming' | 'done' | 'error';

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
  /** Linux: the confirm sheet shows the last highlighted text (PRIMARY), which may be from earlier. */
  confirmFromHighlight: boolean;
  /** Who Explain sends the code to, for the confirm sheet (Security U10). */
  providerName: string;
  /** The answer is the short default (2 to 4 sentences), so "More detail" is offered under it. */
  short: boolean;
  /** "More detail": the full-depth text streamed under the short answer, and whether it is shown. */
  detail: DetailState;
  /** Got it was pressed for this explanation: the button stays pressed and a second press does nothing (Design Q1). */
  understood: boolean;
  /** "Show all N lines" is open on the code block. */
  codeOpen: boolean;
}

interface DetailState {
  phase: 'idle' | 'streaming' | 'done' | 'error';
  text: string;
  error: string;
  open: boolean;
}

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

const NO_DETAIL: DetailState = { phase: 'idle', text: '', error: '', open: false };

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
    confirmFromHighlight: false,
    providerName: CONSENT_PROVIDERS.unvibe,
    short: false,
    detail: NO_DETAIL,
    understood: false,
    codeOpen: false,
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
  // macOS refused (or is still asking about) System Events, so the shortcut's copy read nothing.
  const [automation, setAutomation] = useState<'automation_denied' | 'automation_timeout' | null>(null);
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
        <div className="sub">To explain a selection straight from any app, turn on the shortcut. Pressing it sends the selected code to {CONSENT_PROVIDERS.unvibe} through Unvibe. macOS asks once.</div>
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
      {automation === 'automation_denied' ? (
        <div className="access-note" role="status">
          macOS is blocking Unvibe from copying your selection. In System Settings, open Privacy &amp; Security, then Automation, and turn on System Events under Unvibe. Then press {shortcut} again.
          <div className="empty-actions"><button className="btn ghost" onClick={() => void window.unvibe.openAutomation()}>Open Automation settings</button></div>
        </div>
      ) : automation === 'automation_timeout' ? (
        <div className="access-note" role="status">If macOS asked to let Unvibe control System Events, choose Allow, then press {shortcut} again.</div>
      ) : null}
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
/** widgetOut's length (widget.css). */
const PANEL_EXIT_MS = 160;

function Widget() {
  const [tabs, setTabs] = useState<TabState[]>([newTab('1', 'Review')]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [collapsed, setCollapsed] = useState(false);
  // Collapsing from ⋯ unmounts the menu button; focus goes to the Expand button that replaces it.
  const expandRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (collapsed && (!document.activeElement || document.activeElement === document.body)) expandRef.current?.focus();
  }, [collapsed]);
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
  // "Understood. Saved to your Library." once main has saved it (Design Q1), for TOAST_MS, on the tab it belongs to.
  const [toast, setToast] = useState<{ tabId: string; text: string; leaving?: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  /** performance.now() of the last Got it press, so the toast never lands inside Vibe's squash. */
  const gotItAt = useRef(0);
  // While checkout is closed the panel says "Pro opens soon" instead of offering a purchase.
  const [proOpen, setProOpen] = useState(false);
  useEffect(() => { void window.unvibe.billingStatus().then((status) => setProOpen(status.paymentsOpen)); }, []);
  const bodyRef = useRef<HTMLDivElement>(null);
  /**
   * When a short answer arrives (its More detail block mounts once typing ends), scroll the body just
   * enough to show the button plus 12 px, never past the top of the short answer (Design, 2 Nov). Instant,
   * once per answer; showing or hiding the detail later never scrolls.
   */
  const revealMoreDetail = useCallback((block: HTMLDivElement | null) => {
    const body = bodyRef.current;
    if (!block || !body) return;
    const bodyBox = body.getBoundingClientRect();
    const toggle = block.querySelector<HTMLElement>('.more-detail__toggle') ?? block;
    const hidden = toggle.getBoundingClientRect().bottom + 12 - bodyBox.bottom;
    if (hidden <= 0) return;
    const answer = body.querySelector<HTMLElement>('.short-answer');
    const answerTop = answer ? answer.getBoundingClientRect().top - bodyBox.top + body.scrollTop : Number.POSITIVE_INFINITY;
    body.scrollTop = Math.min(body.scrollTop + hidden, Math.max(body.scrollTop, answerTop));
  }, []);
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeTabId);
  tabsRef.current = tabs;
  activeRef.current = activeTabId;

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!;
  const outOfExplanations = usage ? usage.remaining <= 0 : false;
  const offer = usage ? limitOfferCopy(usage.plan, usage, proOpen) : null;
  const sessionPaused = Boolean(outOfExplanations && offer?.primaryKind === 'survey');
  // The panel leaves the way it came (SPEC §6; Motion, app-0151 moment 4): widgetOut, then main closes the window.
  // Stable, so the key handler's effect needn't re-register; a second close while leaving does nothing. A close
  // from main stays instant, and with reduced motion this one is too.
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const closePanel = useCallback(() => {
    if (leavingRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.unvibe.closeWidget();
      return;
    }
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => window.unvibe.closeWidget(), PANEL_EXIT_MS);
  }, []);
  const [features, setFeatures] = useState({ whyExists: true, teachBack: true, voice: false, changeBrief: true });
  const [listening, setListening] = useState(false);
  /** The PMF survey card (FE-09) while it is open in this panel; null when hidden or closed. */
  const [pmf, setPmf] = useState<PmfCardModel | null>(null);
  const pmfClosed = useRef(false);
  const pmfSaveTimer = useRef<number | undefined>(undefined);
  const pmfPending = useRef<PmfDraft | null>(null);

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

  // Keep typography in proportion when someone makes the panel much smaller than its 440×740 opening size.
  // Height counts from 640 down, so a panel the screen shortened on opening (fitPanelBounds) still reads at 1.
  // The native window owns size; the renderer only exposes a bounded visual scale.
  useEffect(() => {
    const updateScale = () => {
      const scale = Math.max(0.78, Math.min(1, Math.min(window.innerWidth / 440, window.innerHeight / 640)));
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
      if (ev.type === 'graded' && tabId === activeRef.current) setBuddyMood(ev.correct ? 'celebrate' : 'confused');
      if (ev.type === 'understood' && tabId === activeRef.current) {
        window.clearTimeout(toastTimer.current);
        // Three steps (Motion, app-0151 moment 2): wait out Vibe's squash, hold TOAST_MS, then leave over TOAST_EXIT_MS.
        const show = () => {
          setToast({ tabId, text: 'Understood. Saved to your Library.' });
          toastTimer.current = window.setTimeout(() => {
            setToast((t) => (t ? { ...t, leaving: true } : t));
            toastTimer.current = window.setTimeout(() => setToast(null), TOAST_EXIT_MS);
          }, TOAST_MS);
        };
        // Main usually saves within the squash; then the toast waits for it to finish. A slower save shows at once.
        const wait = gotItAt.current + SQUASH_MS - performance.now();
        if (wait > 0) toastTimer.current = window.setTimeout(show, wait);
        else show();
      }
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        if (!tab) return prev;

        // "More detail" streams under the short answer; the answer and its actions stay as they are.
        if ('part' in ev && ev.part === 'detail') {
          const detail = tab.detail;
          switch (ev.type) {
            case 'status':
              return patchTab(prev, tabId, { detail: { phase: 'streaming', text: '', error: '', open: true } });
            case 'token':
              return patchTab(prev, tabId, { detail: { ...detail, phase: 'streaming', text: detail.text + (ev.text ?? '') } });
            case 'done':
              return patchTab(prev, tabId, { detail: { ...detail, phase: 'done' } });
            case 'error':
              return patchTab(prev, tabId, { detail: { ...detail, phase: 'error', error: ev.message ?? 'Something went wrong.' } });
          }
          return prev;
        }

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
              short: false,
              detail: NO_DETAIL,
              understood: false,
              codeOpen: false,
              quiz: null,
              error: '',
              mock: false,
              phase: ev.consentProvider ? 'aiConsent' : ev.hasCode ? (ev.confirm ? 'confirm' : 'ready') : 'empty',
              consentProvider: ev.consentProvider ?? null,
              confirmAfterConsent: Boolean(ev.confirm),
              confirmAfterAgree: Boolean(ev.confirm) && tab.agreedJustNow,
              confirmFromHighlight: ev.confirmFrom === 'highlight',
              agreedJustNow: false,
              providerName: ev.providerName,
              level: ev.level,
            });
          }
          case 'understood':
            return patchTab(prev, tabId, { understood: true });
          case 'status':
            playTone('think');
            // A follow-up answers within the same saved lesson (resetQuiz false), so Got it stays pressed and Test me
            // stays closed over the new answer; a new explanation (Explain differently, another depth) starts afresh.
            return patchTab(prev, tabId, { text: '', short: ev.short === true, detail: NO_DETAIL, understood: ev.resetQuiz === false ? tab.understood : false, phase: 'streaming', quiz: ev.resetQuiz === false ? tab.quiz : null, quizHidden: ev.resetQuiz === false });
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
            return patchTab(prev, tabId, { mock: Boolean(ev.mock), phase: 'done', short: ev.short === true });
          case 'error':
            return patchTab(prev, tabId, {
              error: ev.message ?? 'Something went wrong.',
              phase: 'error',
              quiz: tab.quiz && tab.quiz.phase !== 'graded' ? null : tab.quiz,
            });
          case 'quizError':
            return patchTab(prev, tabId, { quiz: { phase: 'failed', error: ev.message } });
          case 'cancelled':
            return patchTab(prev, tabId, { text: '', short: false, detail: NO_DETAIL, quiz: null, phase: 'ready' });
          case 'question':
            return patchTab(prev, tabId, {
              quiz: {
                phase: 'answering',
                question: ev.question,
                options: ev.options,
                index: ev.index,
                total: ev.total,
                mode: ev.mode,
              },
            });
          case 'graded':
            // A right answer sounds once: header Vibe's celebrate reaction plays its tone (setBuddyMood above).
            if (!ev.correct) playTone('wrong');
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

  // The answer and More detail reveal whole words as they stream, and the arriving words fade in (reveal.ts).
  const answer = useRevealedText(active.text, active.phase === 'streaming', active.phase === 'streaming' || active.phase === 'done', activeTabId);
  const showText = answer.text;
  const stillTyping = answer.typing;
  const wordFade = answer.words;
  const detail = useRevealedText(active.detail.text, active.detail.phase === 'streaming', active.detail.phase === 'streaming' || active.detail.phase === 'done', activeTabId);

  // Autoscroll while streaming on the active tab.
  useEffect(() => {
    if (active.phase === 'streaming' && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [showText, active.phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'w') closePanel();
      else if (e.key === 'Escape') {
        // An open Test me closes first (focus goes back to Test me); only then does Esc collapse the panel.
        const tab = tabsRef.current.find((t) => t.id === activeRef.current);
        if (!collapsed && tab?.quiz && !tab.quizHidden && (tab.phase === 'streaming' || tab.phase === 'done')) closeQuiz();
        else toggleCollapse();
      }
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

  /**
   * "More detail" under a short answer: the first press streams the full depth below the short
   * answer (nothing above it moves); after that the button only shows or hides it. A failed run
   * can be asked for again. Focus stays on the button.
   */
  const toggleDetail = () => {
    const detail = active.detail;
    if (detail.phase === 'done' || detail.phase === 'streaming') {
      setTabs((prev) => patchTab(prev, activeRef.current, { detail: { ...detail, open: !detail.open } }));
      return;
    }
    setTabs((prev) => patchTab(prev, activeRef.current, { detail: { phase: 'streaming', text: '', error: '', open: true } }));
    // Not request(): More detail is a follow-up, not a new explanation, so an exhausted explanation
    // allowance must not replace the answer on screen; a refusal shows under the short answer.
    window.unvibe.request({ level: active.level, moreDetail: true });
  };

  // Test me focus (as on cf41d37e): a question that opens takes focus; closing hands it back to Test me.
  const questionRef = useRef<HTMLHeadingElement>(null);
  const quizRef = useRef<HTMLElement>(null);
  const testMeRef = useRef<HTMLButtonElement>(null);
  const focusTestMe = useRef(false);
  const closeQuiz = (returnFocus = true) => {
    focusTestMe.current = returnFocus;
    setTabs((prev) => patchTab(prev, activeRef.current, { quizHidden: true }));
  };

  const openQuiz = (another = false) => {
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
      closePanel();
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
  // The header names the selection ("7 lines of JavaScript", "from Cursor · debounce.js"); the status line
  // lives in `⋯` and, for screen readers, in a hidden status region.
  // Test me takes the body's place, and the header says so: "Test me" / "<file> · <Depth>" (SPEC §4).
  const quizOpen = Boolean(active.quiz && !active.quizHidden && (phase === 'streaming' || phase === 'done'));
  const selection = active.meta.lines ? selectionTitle(active.meta.lines, active.meta.language) : undefined;
  const headTitle = quizOpen ? 'Test me' : selection ?? 'Ready';
  const headSource = quizOpen
    ? [active.meta.file?.split(/[\\/]/).pop() || selection, LEVELS.find((l) => l.id === active.level)?.label].filter(Boolean).join(' · ')
    : active.meta.lines ? selectionSource(active.meta.sourceApp, active.meta.file) : undefined;
  // Focus moves into Test me whenever what it shows opens: a question (Test me, Another question, reopening) or, while
  // one is being written or failed, the section itself. Grading, choosing an option and tab switches leave it alone.
  const quizKey = !quizOpen || !active.quiz ? null : active.quiz.question ? `q:${active.quiz.index ?? 1}:${active.quiz.question}` : active.quiz.phase;
  const lastQuiz = useRef<{ tab: string; key: string | null }>({ tab: '', key: null });
  useEffect(() => {
    if (quizKey && quizKey !== lastQuiz.current.key && lastQuiz.current.tab === active.id) {
      (questionRef.current ?? quizRef.current)?.focus();
    }
    lastQuiz.current = { tab: active.id, key: quizKey };
  }, [quizKey, active.id]);
  useEffect(() => {
    if (!focusTestMe.current || quizOpen) return;
    focusTestMe.current = false;
    testMeRef.current?.focus();
  }, [quizOpen]);

  // The survey card waits until an explanation has fully finished, typing included, and is asked
  // for again after each one until it is sent or closed. Main decides eligibility.
  const pmfReady = phase === 'done' && !stillTyping && active.text.length > 0;
  useEffect(() => {
    if (!pmfReady || pmf || pmfClosed.current) return;
    let live = true;
    void window.unvibe.pmfState().then((state) => {
      if (live && state.show && !pmfClosed.current) setPmf({ draft: state.draft, stage: 'form', error: '', installId: '' });
    }).catch(() => undefined);
    return () => { live = false; };
  }, [pmfReady, pmf]);
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
  // The row under the header: the depth chip while there's code to explain, "Saved on this Mac" once it's saved.
  const showDepth = !sessionPaused && (phase === 'ready' || phase === 'streaming' || phase === 'done' || phase === 'boot');
  const showSaveNote = !active.mock && phase === 'done';

  const menuItems = panelMenuItems({
    status: phaseLabel.charAt(0).toUpperCase() + phaseLabel.slice(1),
    answerReady: phase === 'done' && !stillTyping,
    features,
    teachOpen,
    dark: panelTheme === 'dark',
    usage: usage ? { remaining: usage.remaining, resetsOn: new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) } : undefined,
  }, {
    // These act on the explanation, so an open Test me makes way first (focus goes where the item sends it).
    explain: () => { closeQuiz(false); requestAnimationFrame(() => document.querySelector('.body')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); },
    depth: () => (document.querySelector('.depth-chip') as HTMLButtonElement | null)?.click(),
    testMe: () => openQuiz(),
    ask: () => { closeQuiz(false); requestAnimationFrame(() => (document.querySelector('.askrow input') as HTMLInputElement | null)?.focus()); },
    why: () => { closeQuiz(false); askWhy(); },
    teach: () => { closeQuiz(false); setTeachOpen((open) => !open); },
    newTab: addTab,
    saved: () => window.unvibe.openStudy(),
    theme: () => setPanelTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    collapse: toggleCollapse,
  });

  return (
    <div className={`card card--${phase}${away ? ' card--away' : ''}${collapsed ? ' card--collapsed' : ''}${leaving ? ' card--leaving' : ''}`} aria-label="Unvibe">
      {!collapsed ? <ResizeGrips /> : null}
      <div className="head">
        <span className="head__mark head__mark--vibe" aria-hidden="true">
          <Buddy mood={phase === 'streaming' ? (active.text ? 'reading' : 'thinking') : phase === 'error' || phase === 'blocked' ? 'confused' : 'idle'} size={30} label="Vibe" listen />
        </span>
        <div className="head__context">
          <span className="head__title">{headTitle}</span>
          {headSource ? <span className="head__source">{headSource}</span> : null}
        </div>
        <span className="sr-only" role="status">{phaseLabel}</span>
        <div className="head__actions">
          {collapsed ? (
            // A collapsed panel is 52 px tall (main.ts), too short for the menu: the way back is right here.
            <button ref={expandRef} className="head__glyph" aria-label="Expand panel" aria-expanded="false" title="Expand" onClick={toggleCollapse}>
              <span aria-hidden="true">▾</span>
            </button>
          ) : (
            <MenuButton className="head__glyph head__more" items={menuItems} menuLabel="Panel" ariaLabel="More" title="More">
              <span aria-hidden="true">⋯</span>
            </MenuButton>
          )}
          <button className="head__glyph" aria-label="Close panel" title="Close" onClick={closePanel}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
      {!collapsed && !quizOpen && (showDepth || showSaveNote) ? (
        <div className="head-bar">
          {showDepth ? (
            <LevelChip level={active.level} plan={usage?.plan} disabled={outOfExplanations} onPick={(id) => { setProGate(false); pick(id); }} />
          ) : <span />}
          {showSaveNote ? <span className="local-save-note">Saved on this {deviceName}</span> : null}
        </div>
      ) : null}

      {!collapsed ? (
        <div className="widget-workspace">
          <section className="widget-main">

      {!collapsed && !sessionPaused && (
        <TabStrip tabs={tabs} activeId={activeTabId} onSelect={selectTab} onClose={closeTab} />
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
                onCancel={closePanel}
              />
            </div>
          )}

          {phase === 'ready' && (
            <div className="state ready-state">
              <div className="container-progress" aria-label="Explanation progress"><span className="on">1 · captured</span><span className="on">2 · filtered</span><span>3 · explaining</span></div>
              <div className="big">Reading your code in context…</div>
              <div className="detected">
                <span>{active.meta.language && active.meta.language !== 'plaintext' ? active.meta.language : 'Code selection'}</span>
                <span>{linesLabel(active.meta.lines ?? 0)}</span>
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
                <span>{linesLabel(active.meta.lines ?? 0)}</span>
                {active.meta.sourceApp && <span>{active.meta.sourceApp}</span>}
              </div>
              {active.meta.preview ? (
                <section className="code-context" aria-label={active.confirmFromHighlight ? 'The last text you highlighted' : 'Code from your clipboard'}>
                  <pre tabIndex={0}><code>{active.meta.preview}</code></pre>
                </section>
              ) : null}
              <div className="sub">
                {active.confirmFromHighlight
                  ? 'This is the last text you highlighted, in any app. It may be from earlier, so check it is the code you mean.'
                  : active.confirmAfterAgree
                    ? 'This is what is on your clipboard now.'
                    : 'Your editor or a link asked Unvibe to explain what is on your clipboard.'}{' '}
                Nothing has been sent yet. Explain sends it to {active.providerName}.
              </div>
              <button className="btn" onClick={() => request({})}>
                Explain
              </button>
              <button className="btn ghost" onClick={closePanel}>
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
              <button className="btn ghost" onClick={closePanel}>
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
            <div className="body" ref={bodyRef} tabIndex={0} role="region" aria-label="Explanation" aria-live="polite" aria-atomic="false" hidden={quizOpen}>
              {active.meta.preview ? (
                <CodeBlock
                  id={`code-${active.id}`}
                  code={active.meta.preview}
                  language={languageName(active.meta.language)}
                  open={active.codeOpen}
                  onToggle={() => setTabs((prev) => patchTab(prev, activeTabId, { codeOpen: !prev.find((t) => t.id === activeTabId)?.codeOpen }))}
                />
              ) : null}
              {showText
                ? (active.short ? <ShortAnswer text={showText} streaming={stillTyping} words={wordFade} /> : renderRich(showText, stillTyping, { words: wordFade }))
                : (
                  <ThinkingCard hasCode={Boolean(active.meta.preview)} />
                )}
              {active.short && phase === 'done' && !stillTyping ? (
                <div className="more-detail" ref={revealMoreDetail}>
                  <button
                    type="button"
                    className="more-detail__toggle"
                    aria-expanded={active.detail.open}
                    aria-controls={`more-detail-${active.id}`}
                    onClick={toggleDetail}
                  >
                    {active.detail.open ? 'Less detail' : 'More detail'}
                    <svg className="more-detail__chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
                  </button>
                  {active.detail.open ? (
                    <div className="more-detail__body" id={`more-detail-${active.id}`}>
                      {detail.text
                        ? renderRich(detail.text, detail.typing, { words: detail.words })
                        : active.detail.phase === 'streaming' ? <p className="more-detail__wait" role="status">Writing more detail…</p> : null}
                      {active.detail.phase === 'error' ? <p className="more-detail__error" role="alert">{active.detail.error}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {pmf && pmfReady ? (
                <PmfCard
                  model={pmf}
                  onChange={changePmf}
                  onSend={sendPmf}
                  onDismiss={dismissPmf}
                  onClose={() => { pmfClosed.current = true; setPmf(null); }}
                />
              ) : null}
            </div>
            {quizOpen && active.quiz ? (
              <section className="body body--quiz" aria-label="Test me" ref={quizRef} tabIndex={-1}>
                <QuizCard
                  quiz={active.quiz}
                  questionRef={questionRef}
                  onChoose={(i) => setTabs((prev) => {
                    const quiz = prev.find((t) => t.id === activeTabId)?.quiz;
                    return quiz ? patchTab(prev, activeTabId, { quiz: { ...quiz, choice: i } }) : prev;
                  })}
                />
              </section>
            ) : null}
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
              <div className="panel-toast-region" role="status">{toast?.tabId === active.id ? <PanelToast text={toast.text} leaving={toast.leaving} /> : null}</div>
              {quizOpen && active.quiz ? (
                <QuizActions
                  quiz={active.quiz}
                  onCheck={() => {
                    const choice = active.quiz?.choice;
                    if (choice === undefined) return;
                    window.unvibe.answer(choice);
                    setTabs((prev) => {
                      const quiz = prev.find((t) => t.id === activeTabId)?.quiz;
                      return quiz ? patchTab(prev, activeTabId, { quiz: { ...quiz, phase: 'grading' } }) : prev;
                    });
                  }}
                  onAnother={() => openQuiz(true)}
                  onRetry={() => openQuiz()}
                  onClose={() => closeQuiz()}
                />
              ) : (
                <PanelActions
                  streaming={phase === 'streaming'}
                  busy={stillTyping}
                  understood={active.understood}
                  testMeRef={testMeRef}
                  onStop={() => window.unvibe.cancel()}
                  onGotIt={() => {
                    // Vibe is happy once and the panel stays open; the toast comes when main has saved it (Design Q1).
                    gotItAt.current = performance.now();
                    setBuddyMood('happy');
                    setTabs((prev) => patchTab(prev, activeTabId, { understood: true }));
                    window.unvibe.gotIt();
                  }}
                  onDifferent={() => request({ variant: 'different' })}
                  onTestMe={() => openQuiz()}
                >
                  {active.mock && (
                    <span className="mock-note">mock AI. Set ANTHROPIC_API_KEY for real explanations</span>
                  )}
                </PanelActions>
              )}
              {active.originOpen && !quizOpen ? (
                <div className="origin-panel" role="region" aria-label="Why this exists">
                  <div className="ask-sandbox__label">Source facts</div>
                  {active.originError ? <p className="sub">{active.originError}</p> : null}
                  {active.originFacts.map((fact) => (
                    <p key={fact.label}><strong>{fact.label}.</strong> {fact.value}</p>
                  ))}
                  <p className="origin-inference">{active.originInference || 'No documented rationale found.'}</p>
                </div>
              ) : null}
              {features.teachBack && phase === 'done' && teachOpen && !quizOpen ? (
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
              <div className="ask-sandbox" hidden={quizOpen}>
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

trackWindowAway();
createRoot(document.getElementById('root')!).render(<Widget />);
