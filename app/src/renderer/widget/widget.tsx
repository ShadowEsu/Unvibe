import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { WidgetEvent } from '../../main/review';
import type { ExplanationLevel } from '../../core/protocol';
import type { SecretFinding } from '../../core/secretFilter';
import { LogoMark } from '../shared/logo';
import { renderRich } from '../shared/richText';
import { BETA_SURVEY_URL, limitOfferCopy } from '../shared/limitOffer';
import { prettyShortcut } from '../shared/prettyShortcut';
import { UsageRings } from '../shared/usageRings';
import '../shared/tokens.css';

type Phase = 'boot' | 'ready' | 'empty' | 'consent' | 'blocked' | 'streaming' | 'done' | 'error';

interface Quiz {
  phase: 'loading' | 'answering' | 'grading' | 'graded';
  question?: string;
  options?: string[];
  conceptLabel?: string;
  choice?: number;
  correct?: boolean;
  answerIndex?: number;
  rationale?: string;
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
  history: HistoryEntry[];
  originOpen: boolean;
  originError: string;
  originFacts: Array<{ label: string; value: string }>;
  originInference: string;
  teachAnswer: string;
  teachNote: string;
  teachChecks: Array<{ topic: string; mark: 'covered' | 'partial' | 'missed' }>;
  teachEvidence: string;
}

const LEVELS: Array<{ id: ExplanationLevel; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
];

function ToolIcon({ name }: { name: 'explain' | 'depth' | 'quiz' | 'ask' | 'library' }) {
  const paths = {
    explain: 'M7 4 3 8l4 4 M13 4l4 4-4 4 M11 2 9 14',
    depth: 'M3 4h14 M5 8h10 M7 12h6',
    quiz: 'M6.5 6a3.5 3.5 0 1 1 5.1 3.1c-1.7.9-2.1 1.6-2.1 2.9 M9.5 16h.01',
    ask: 'M4 15 16 3 M8 3h8v8',
    library: 'M4 3h10a2 2 0 0 1 2 2v11H6a2 2 0 0 0-2 2V3z M6 16h10',
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
  };
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function startSpeech(onText: (text: string) => void, onStop: () => void): SpeechRec | null {
  const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.onresult = (ev) => {
    const last = ev.results[ev.results.length - 1];
    const transcript = last?.[0]?.transcript?.trim();
    if (transcript) onText(transcript);
  };
  rec.onerror = () => onStop();
  rec.onend = () => onStop();
  rec.start();
  return rec;
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

/** Calm fallback when ⌘U finds no selection — pick a source, never hard-error. */
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
      <div className="big">Ready when you are.</div>
      <div className="sub">
        Let’s make that code click. Select a snippet and press {shortcut}, or drop it here.
      </div>
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

function Widget() {
  const [tabs, setTabs] = useState<TabState[]>([newTab('1', 'Review')]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [collapsed, setCollapsed] = useState(false);
  const [shortcut, setShortcut] = useState('⌘U');
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [proGate, setProGate] = useState(false);
  const [activeTool, setActiveTool] = useState<'explain' | 'depth' | 'quiz' | 'ask'>('explain');
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeTabId);
  tabsRef.current = tabs;
  activeRef.current = activeTabId;

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!;
  const outOfExplanations = usage ? usage.remaining <= 0 : false;
  const offer = usage ? limitOfferCopy(usage.plan, usage) : null;
  const sessionPaused = Boolean(outOfExplanations && offer?.primaryKind === 'survey');
  const [revealedText, setRevealedText] = useState('');
  const [features, setFeatures] = useState({ whyExists: true, teachBack: true, voice: false, changeBrief: true });
  const [listening, setListening] = useState(false);
  const speechRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const refreshUsage = () => {
      void window.unvibe.usageGet().then((result) => {
        const r = result as { ok?: boolean; data?: UsageState };
        if (!r.ok || !r.data) return;
        setUsage(r.data);
      });
    };
    void window.unvibe.getSettings().then((st) => {
      const s = st as { theme?: 'system' | 'light' | 'dark'; features?: typeof features };
      applyTheme(s.theme ?? 'system');
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
              phase: ev.hasCode ? 'ready' : 'empty',
            });
          }
          case 'understood':
            return prev;
          case 'status':
            return patchTab(prev, tabId, { text: '', phase: 'streaming', quiz: null });
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
            return patchTab(prev, tabId, { mock: Boolean(ev.mock), phase: 'done' });
          case 'error':
            return patchTab(prev, tabId, {
              error: ev.message ?? 'Something went wrong.',
              phase: 'error',
              quiz: tab.quiz && tab.quiz.phase !== 'graded' ? null : tab.quiz,
            });
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
              },
            });
          case 'graded':
            return patchTab(prev, tabId, {
              quiz: tab.quiz
                ? {
                    ...tab.quiz,
                    phase: 'graded',
                    correct: ev.correct,
                    answerIndex: ev.answerIndex,
                    rationale: ev.rationale,
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
      if (e.metaKey && e.key === 'w') window.unvibe.closeWidget();
      else if (e.key === 'Escape') toggleCollapse();
      else if (e.metaKey && e.key >= '1' && e.key <= '5') pick(LEVELS[Number(e.key) - 1]!.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, activeTabId]);

  const request = (opts: Record<string, unknown>) => {
    if (outOfExplanations) {
      setTabs((prev) => patchTab(prev, activeRef.current, {
        phase: 'error',
        error: usage
          ? limitOfferCopy(usage.plan, usage).body
          : 'You have reached your monthly explanation limit. Open Plan to upgrade.',
      }));
      return;
    }
    window.unvibe.request({ level: active.level, ...opts });
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
  const phaseLabel = phase === 'boot' ? 'capturing' : phase === 'ready' ? 'reading' : phase === 'streaming' ? 'explaining' : phase === 'done' ? 'ready to learn' : phase === 'empty' ? 'waiting' : phase;
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

  return (
    <div className={`card card--${phase}${active.quiz ? ' card--quiz' : ''}`} aria-label="Unvibe">
      <div className="sanFranWash" aria-hidden="true" />
      {!collapsed ? <ResizeGrips /> : null}
      <div className="head">
        <span className="head__mark" aria-hidden="true">
          <LogoMark size={18} stroke={1.9} />
        </span>
        <div className="head__context">
          <span className="head__product">Unvibe</span>
          {src}
        </div>
        <span className={`head__status head__status--${phase}`}><i />{phaseLabel}</span>
        <div className="head__actions">
          <button aria-label={collapsed ? 'Expand' : 'Collapse'} onClick={toggleCollapse}>
            {collapsed ? '▾' : '▴'}
          </button>
          <button aria-label="Close panel" onClick={() => window.unvibe.closeWidget()}>
            ✕
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="widget-workspace">
          <aside className="widget-tools" aria-label="Review tools">
            <div className="widget-tools__title"><LogoMark size={19} stroke={2} /><span>Workspace</span></div>
            <button className={activeTool === 'explain' ? 'on' : ''} type="button" title="Explanation" onClick={() => {
              setActiveTool('explain');
              document.querySelector('.body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}><ToolIcon name="explain" /><b>Walkthrough</b></button>
            <button className={activeTool === 'depth' ? 'on' : ''} type="button" title="Difficulty" onClick={() => {
              setActiveTool('depth');
              document.querySelector('.levels')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}><ToolIcon name="depth" /><b>Depth</b></button>
            <button className={activeTool === 'quiz' ? 'on' : ''} type="button" title="Quiz" disabled={phase !== 'done' || stillTyping} onClick={() => {
              setActiveTool('quiz');
              setTabs((prev) => patchTab(prev, activeTabId, { quiz: { phase: 'loading' } }));
              window.unvibe.testMe();
            }}><ToolIcon name="quiz" /><b>Quick Quiz</b></button>
            <button className={activeTool === 'ask' ? 'on' : ''} type="button" title="Ask a follow-up" onClick={() => {
              setActiveTool('ask');
              requestAnimationFrame(() => (document.querySelector('.askrow input') as HTMLInputElement | null)?.focus());
            }}><ToolIcon name="ask" /><b>Ask Unvibe</b></button>
            <div className="widget-tools__spacer" />
            <button type="button" title="Open saved learning" onClick={() => window.unvibe.openStudy()}><ToolIcon name="library" /><b>Memory</b></button>
            {usage && (
              <div className="widget-tools__usage" title={`${usage.used} of ${usage.limit} explanations used this month. Resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`}>
                <span>Available</span>
                <UsageRings ai={{ used: usage.used, limit: usage.limit, remaining: usage.remaining }} selections={usage.selections} size={26} tiny />
              </div>
            )}
          </aside>
          <section className="widget-main">

      {!collapsed && !sessionPaused && (
        <div className="tabs" role="tablist" aria-label="Review tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === activeTabId}
              className={`tab${t.id === activeTabId ? ' on' : ''}`}
              onClick={() => selectTab(t.id)}
            >
              <span>{t.label}</span>
              <span
                className="tab__x"
                aria-label={`Close ${t.label}`}
                onClick={(e) => closeTab(t.id, e)}
              >
                ×
              </span>
            </button>
          ))}
          <button className="tab-add" aria-label="Add tab" title="Add another review tab" onClick={addTab}>
            +
          </button>
        </div>
      )}

      {!collapsed && sessionPaused && offer ? (
        <div className="state state--limit state--pause">
          <div className="big">{offer.title}</div>
          <div className="sub">{offer.body}</div>
          <div className="pause-actions">
            <button className="btn" onClick={() => void window.unvibe.openUrl(BETA_SURVEY_URL)}>
              {offer.primary}
            </button>
            {offer.showPlan ? (
              <button className="btn ghost" onClick={() => window.unvibe.openPlan()}>
                Buy a subscription
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!collapsed && !sessionPaused && (phase === 'ready' || phase === 'streaming' || phase === 'done' || phase === 'boot') && (
        <div className="levels" aria-label="Explanation depth">
          <span className="levels__label">Depth</span>
          {LEVELS.map((l) => {
            const expertLocked = l.id === 'expert' && usage?.plan !== 'pro' && usage?.plan !== 'teams' && usage?.plan !== 'full';
            return (
              <button
                key={l.id}
                data-level={l.id}
                className={`lvl${l.id === active.level ? ' on' : ''}`}
                disabled={outOfExplanations || expertLocked}
                title={expertLocked ? 'Expert explanations are included with Unvibe Pro' : `Explain at ${l.label} depth`}
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
              </button>
            );
          })}
        </div>
      )}

      {!collapsed && !sessionPaused && (
        <>
          {phase === 'boot' && (
            <div className="state">
              <div className="sub">Capturing selection…</div>
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

          {phase === 'empty' && <EmptyPicker shortcut={shortcut} level={active.level} />}

          {phase === 'consent' && (
            <div className="state">
              <div className="big">Possible secret detected</div>
              <div className="findings">
                {active.findings.map((f, i) => (
                  <div key={i}>
                    {f.rule} · line {f.line} · {f.masked}
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
            <div className="state">
              <div className="big">Blocked — credential detected</div>
              <div className="findings">
                {active.findings.map((f, i) => (
                  <div key={i}>
                    {f.rule} · line {f.line} · {f.masked}
                  </div>
                ))}
              </div>
              <div className="sub">This selection stays on your machine. Remove the secret and try again.</div>
            </div>
          )}

          {phase === 'error' && (
            <div className={`state${outOfExplanations ? ' state--limit' : ''}`}>
              <div className="big">
                {outOfExplanations && offer ? offer.title : proGate ? 'Pro feature' : "Couldn't explain that"}
              </div>
              <div className="sub">{active.error}</div>
              {outOfExplanations || proGate ? (
                <>
                  <button className="btn" onClick={() => {
                    if (offer?.primaryKind === 'survey') void window.unvibe.openUrl(BETA_SURVEY_URL);
                    else window.unvibe.openPlan();
                  }}>
                    {outOfExplanations && offer ? offer.primary : 'Upgrade to Pro'}
                  </button>
                  {outOfExplanations && offer?.showPlan && offer.primaryKind === 'survey' ? (
                    <button className="btn ghost" onClick={() => window.unvibe.openPlan()}>
                      Buy a subscription
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
            <div className="body" ref={bodyRef} aria-live="polite" aria-atomic="false">
              {active.meta.preview ? (
                <section className="code-context" aria-label="Selected code context">
                  <div className="code-context__head">
                    <span>Selected code</span>
                    <span>{active.meta.file || active.meta.language || 'Local selection'}</span>
                  </div>
                  <pre><code>{active.meta.preview}</code></pre>
                </section>
              ) : null}
              {showText
                ? renderRich(showText, stillTyping)
                : (
                  <div className="skeleton" aria-label="Generating explanation">
                    <span>Thinking…</span>
                    <i /><i /><i />
                  </div>
                )}
            </div>
            {active.quiz && (
              <aside className="quiz-rail" aria-label="Test me">
                {active.quiz.phase === 'loading' && (
                  <div className="quiz-rail__wait">
                    <span>Writing a question…</span>
                    <i /><i /><i />
                  </div>
                )}
                {active.quiz.phase !== 'loading' && (
                  <div className="quiz">
                    <div className="quiz__kicker">Test me</div>
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
                        <div className={`verdict ${active.quiz.correct ? 'ok' : 'no'}`}>
                          {active.quiz.correct ? 'Correct. That one is understood.' : 'Not quite. Saved to revisit.'}
                        </div>
                        {active.quiz.rationale && (
                          <div className="quiz__why">{active.quiz.rationale}</div>
                        )}
                        <button
                          className="btn ghost"
                          onClick={() => setTabs((prev) => patchTab(prev, activeTabId, { quiz: null }))}
                        >
                          Hide question
                        </button>
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
                          onClick={() => setTabs((prev) => patchTab(prev, activeTabId, { quiz: null }))}
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
                  onClick={() => {
                    setTabs((prev) =>
                      patchTab(prev, activeTabId, { quiz: { phase: 'loading' } }),
                    );
                    window.unvibe.testMe();
                  }}
                >
                  Test me
                </button>
                {features.whyExists ? (
                  <button
                    className="chip"
                    disabled={stillTyping}
                    onClick={() => {
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
                    }}
                  >
                    Why does this exist
                  </button>
                ) : null}
                {active.mock && (
                  <span className="mock-note">mock AI. Set ANTHROPIC_API_KEY for real explanations</span>
                )}
                {!active.mock && phase === 'done' && <span className="local-save-note">saved on this Mac</span>}
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
              {features.teachBack && phase === 'done' ? (
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
                      disabled={stillTyping}
                      onMouseDown={() => {
                        if (listening) return;
                        const rec = startSpeech((text) => {
                          setTabs((prev) => patchTab(prev, activeTabId, { ask: text }));
                        }, () => setListening(false));
                        if (!rec) {
                          setTabs((prev) => patchTab(prev, activeTabId, { ask: 'Speech is not available in this build.' }));
                          return;
                        }
                        speechRef.current = rec;
                        setListening(true);
                      }}
                      onMouseUp={() => {
                        speechRef.current?.stop();
                        speechRef.current = null;
                        setListening(false);
                      }}
                      onMouseLeave={() => {
                        speechRef.current?.stop();
                        speechRef.current = null;
                        setListening(false);
                      }}
                    >
                      {listening ? 'Listening' : 'Hold to ask'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ask"
                    disabled={stillTyping || !active.ask.trim()}
                    onClick={() => {
                      if (!active.ask.trim()) return;
                      request({ question: active.ask.trim() });
                      setTabs((prev) => patchTab(prev, activeTabId, { ask: '' }));
                    }}
                  >
                    Ask
                  </button>
                </div>
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
