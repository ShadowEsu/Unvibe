import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { WidgetEvent } from '../../main/review';
import type { ExplanationLevel } from '../../core/protocol';
import type { SecretFinding } from '../../core/secretFilter';
import { LogoMark } from '../shared/logo';

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
  lines?: number;
  language?: string;
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
}

const LEVELS: Array<{ id: ExplanationLevel; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
];

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
  };
}

/* ---------- tiny renderer: markdown-ish + [[cite:...]] + fenced code ---------- */

const KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|def|fn|pub|async|await|new|try|catch|throw|interface|type|extends|implements|switch|case|break|continue|struct|impl|match|use|package|func|select|where|in|of|not|and|or|None|null|undefined|true|false|self|this)\b/;

function highlight(code: string): ReactNode[] {
  const re = new RegExp(
    `(//.*|#.*|/\\*[\\s\\S]*?\\*/)|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|${KEYWORDS.source}`,
    'g',
  );
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? 'tk-c' : m[2] ? 'tk-s' : m[3] ? 'tk-n' : 'tk-k';
    out.push(
      <span key={k++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="codeblock">
      <div className="cb-head">
        <span>{lang || 'code'}</span>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre>{highlight(code)}</pre>
    </div>
  );
}

function renderInline(text: string): ReactNode[] {
  const re = /\[\[cite:([^\]]+?):(\d+(?:-\d+)?)\]\]|`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const base = m[1].split('/').pop();
      out.push(
        <span key={k++} className="cite" title={`${m[1]}:${m[2]}`}>
          {base}:{m[2]}
        </span>,
      );
    } else if (m[3]) {
      out.push(
        <code key={k++} className="inline">
          {m[3]}
        </code>,
      );
    } else {
      out.push(<b key={k++}>{m[4]}</b>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderRich(raw: string, streaming: boolean): ReactNode[] {
  let text = raw;
  if (streaming) text = text.replace(/\[\[(?:c(?:i(?:t(?:e(?::[^\]]*)?)?)?)?)?$/, '');

  const nodes: ReactNode[] = [];
  const parts = text.split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf('\n');
      const lang = nl === -1 ? '' : part.slice(0, nl).trim();
      const code = nl === -1 ? part : part.slice(nl + 1);
      nodes.push(<CodeBlock key={`cb${i}`} lang={lang} code={code.replace(/\n$/, '')} />);
    } else {
      part
        .split(/\n{2,}/)
        .filter((p) => p.trim().length > 0)
        .forEach((para, j) => nodes.push(<p key={`p${i}-${j}`}>{renderInline(para.trim())}</p>));
    }
  });
  if (streaming) nodes.push(<span key="cur" className="cursor" />);
  return nodes;
}

function prettyAccel(accel: string): string {
  return accel.replace('CommandOrControl', '⌘').replace('Control', '⌃').replace('Shift', '⇧').replace('Alt', '⌥');
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
      <div className="big">What should we explain?</div>
      <div className="sub">
        No selection was captured. Highlight code and press {shortcut}, or choose another source below.
      </div>
      <div className="empty-actions">
        <button className="btn" disabled={picking} onClick={() => window.unvibe.useClipboard({ level })}>
          Use clipboard
        </button>
        <button className="btn ghost" disabled={picking} onClick={() => void chooseFile()}>
          {picking ? 'Opening…' : 'Choose a file…'}
        </button>
        <button className="btn ghost" disabled={picking} onClick={() => void runPro('diff')}>
          Explain git diff · Pro
        </button>
        <button className="btn ghost" disabled={picking} onClick={() => void runPro('brief')}>
          Agent change brief · Pro
        </button>
        <button className="btn ghost" disabled={picking} onClick={() => void runPro('compare')}>
          Since last understood · Pro
        </button>
      </div>
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
  const [limitHit, setLimitHit] = useState(false);
  const [proGate, setProGate] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeTabId);
  tabsRef.current = tabs;
  activeRef.current = activeTabId;

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!;
  const outOfExplanations = limitHit || (usage !== null && usage.remaining <= 0);

  useEffect(() => {
    const refreshUsage = () => {
      void window.unvibe.usageGet().then((result) => {
        const r = result as { ok?: boolean; data?: UsageState };
        if (!r.ok || !r.data) {
          setUsage({ used: 0, limit: 50, remaining: 50, resetsAt: new Date().toISOString(), plan: 'local' });
          return;
        }
        setUsage(r.data);
        setLimitHit(r.data.remaining <= 0);
      });
    };
    void window.unvibe.getSettings().then((st) => {
      const s = st as { theme?: 'system' | 'light' | 'dark' };
      applyTheme(s.theme ?? 'system');
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

  useEffect(() => {
    window.unvibe.onReviewEvent((raw) => {
      const ev = raw as WidgetEvent;
      const tabId = ev.tabId;
      if (ev.type === 'usage') {
        setUsage({
          used: ev.used,
          limit: ev.limit,
          remaining: ev.remaining,
          resetsAt: ev.resetsAt,
          plan: ev.plan,
        });
        setLimitHit(ev.remaining <= 0);
      }
      if (ev.type === 'error' && 'code' in ev && ev.code === 'plan_limit_reached') {
        setLimitHit(true);
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
              meta: { sourceApp: ev.sourceApp, lines: ev.lines, language: ev.language },
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

  // Autoscroll while streaming on the active tab.
  useEffect(() => {
    if (active.phase === 'streaming' && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [active.text, active.phase]);

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
          ? `You have used ${usage.used} of ${usage.limit} explanations this month. Upgrade to Pro or wait until ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`
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

  const src = active.meta.lines ? (
    <span className="src">
      <b>{active.meta.lines} lines</b>
      {active.meta.language && active.meta.language !== 'plaintext' ? ` · ${active.meta.language}` : ''}
      {active.meta.sourceApp ? ` · from ${active.meta.sourceApp}` : ''}
    </span>
  ) : (
    <span className="src">
      <b>Unvibe</b>
    </span>
  );

  const phase = active.phase;

  return (
    <div className="card">
      <div className="head">
        <span className="head__mark" aria-hidden="true">
          <LogoMark size={14} stroke={2} />
        </span>
        {src}
        {usage && (
          <span
            className={`quota${usage.remaining <= 0 ? ' quota--out' : usage.remaining <= 5 ? ' quota--low' : ''}`}
            title={`${usage.used} of ${usage.limit} explanations used this month`}
          >
            {usage.remaining} left
          </span>
        )}
        <button aria-label={collapsed ? 'Expand' : 'Collapse'} onClick={toggleCollapse}>
          {collapsed ? '▾' : '▴'}
        </button>
        <button aria-label="Close panel" onClick={() => window.unvibe.closeWidget()}>
          ✕
        </button>
      </div>

      {!collapsed && (
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

      {!collapsed && (phase === 'ready' || phase === 'streaming' || phase === 'done' || phase === 'boot') && (
        <div className="levels">
          {LEVELS.map((l) => {
            const expertLocked = l.id === 'expert' && usage?.plan !== 'pro' && usage?.plan !== 'teams';
            return (
              <button
                key={l.id}
                className={`lvl${l.id === active.level ? ' on' : ''}`}
                disabled={outOfExplanations || expertLocked}
                title={expertLocked ? 'Expert explanations are included with Unvibe Pro' : undefined}
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

      {!collapsed && (
        <>
          {phase === 'boot' && (
            <div className="state">
              <div className="sub">Capturing selection…</div>
            </div>
          )}

          {phase === 'ready' && (
            <div className="state ready-state">
              <div className="big">Starting explanation…</div>
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
            <div className="state">
              <div className="big">{outOfExplanations ? 'Monthly limit reached' : proGate ? 'Pro feature' : "Couldn't explain that"}</div>
              <div className="sub">{active.error}</div>
              {outOfExplanations || proGate ? (
                <>
                  <button className="btn" onClick={() => window.unvibe.openCompanion()}>
                    {outOfExplanations ? 'Add API key or upgrade' : 'Upgrade to Pro'}
                  </button>
                  <button className="btn ghost" onClick={() => { setProGate(false); window.unvibe.openStudy(); }}>
                    {outOfExplanations ? 'Return to saved learning' : 'Maybe later'}
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => request({})}>
                  Retry
                </button>
              )}
            </div>
          )}

          {(phase === 'streaming' || phase === 'done') && !active.quiz && (
            <div className="body" ref={bodyRef} aria-live="polite" aria-atomic="false">
              {active.history.map((h) => (
                <section key={h.id} className="history-entry">
                  <div className="history-entry__meta">
                    <span>
                      {h.meta.language && h.meta.language !== 'plaintext' ? h.meta.language : 'Code'}
                      {h.meta.lines ? ` · ${h.meta.lines} lines` : ''}
                    </span>
                    <span>{h.at}</span>
                  </div>
                  {renderRich(h.text, false)}
                </section>
              ))}
              {active.history.length > 0 && <div className="history-sep">Latest</div>}
              {active.text
                ? renderRich(active.text, phase === 'streaming')
                : (
                  <div className="skeleton" aria-label="Generating explanation">
                    <i /><i /><i />
                  </div>
                )}
            </div>
          )}

          {active.quiz && (phase === 'streaming' || phase === 'done') && (
            <div className="body">
              {active.quiz.phase === 'loading' && (
                <div className="state"><div className="sub">Writing you a question…</div></div>
              )}
              {active.quiz.phase !== 'loading' && (
                <div className="quiz">
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
                          {o}
                        </button>
                      );
                    })}
                  </div>
                  {active.quiz.phase === 'graded' ? (
                    <>
                      <div className={`verdict ${active.quiz.correct ? 'ok' : 'no'}`}>
                        {active.quiz.correct ? 'Correct — that one is understood.' : 'Not quite — saved to revisit.'}
                      </div>
                      {active.quiz.rationale && (
                        <div className="quiz__why">{active.quiz.rationale}</div>
                      )}
                      <button
                        className="btn ghost"
                        onClick={() => setTabs((prev) => patchTab(prev, activeTabId, { quiz: null }))}
                      >
                        Back to the explanation
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
            </div>
          )}

          {(phase === 'streaming' || phase === 'done') && !active.quiz && (
            <div className="foot">
              <div className="chips">
                {phase === 'streaming' && (
                  <button className="chip" onClick={() => window.unvibe.cancel()}>
                    Stop generating
                  </button>
                )}
                <button
                  className="chip"
                  disabled={phase === 'streaming'}
                  onClick={() => {
                    window.unvibe.gotIt();
                    toggleCollapse();
                  }}
                >
                  Got it ✓
                </button>
                <button
                  className="chip"
                  disabled={phase === 'streaming'}
                  onClick={() => request({ variant: 'different' })}
                >
                  Explain differently
                </button>
                <button
                  className="chip"
                  disabled={phase === 'streaming'}
                  onClick={() => {
                    setTabs((prev) =>
                      patchTab(prev, activeTabId, { quiz: { phase: 'loading' } }),
                    );
                    window.unvibe.testMe();
                  }}
                >
                  Test me
                </button>
                {active.mock && (
                  <span className="mock-note">mock AI — set ANTHROPIC_API_KEY for real explanations</span>
                )}
              </div>
              <div className="askrow">
                <input
                  placeholder="Ask a follow-up… (why does this exist? what breaks if I remove it?)"
                  value={active.ask}
                  disabled={phase === 'streaming'}
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
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Widget />);
