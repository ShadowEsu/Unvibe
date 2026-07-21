import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { WidgetEvent } from '../../main/review';
import type { ExplanationLevel } from '../../core/protocol';
import type { SecretFinding } from '../../core/secretFilter';
import { LogoMark } from '../shared/logo';
import { renderRich } from '../shared/richText';

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

function prettyAccel(accel: string): string {
  return accel.replace('CommandOrControl', '⌘').replace('Control', '⌃').replace('Shift', '⇧').replace('Alt', '⌥');
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
  const [proGate, setProGate] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeTabId);
  tabsRef.current = tabs;
  activeRef.current = activeTabId;

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!;
  const outOfExplanations = usage ? usage.remaining <= 0 : false;
  const [revealedText, setRevealedText] = useState('');

  useEffect(() => {
    const refreshUsage = () => {
      void window.unvibe.usageGet().then((result) => {
        const r = result as { ok?: boolean; data?: UsageState };
        if (!r.ok || !r.data) return;
        setUsage(r.data);
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
      <b>Ready</b>
    </span>
  );

  const phase = active.phase;
  const showText = phase === 'streaming' || phase === 'done' ? revealedText : active.text;
  const stillTyping = phase === 'streaming' || (phase === 'done' && revealedText.length < active.text.length);

  return (
    <div className={`card card--${phase}`} aria-label="Unvibe">
      {!collapsed ? <ResizeGrips /> : null}
      <div className="head">
        <span className="head__mark" aria-hidden="true">
          <LogoMark size={14} stroke={2} tone="onFill" />
        </span>
        <div className="head__context">
          <span className="head__product">Unvibe</span>
          {src}
        </div>
        <span className="head__spacer" />
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
        <div className="levels" aria-label="Explanation depth">
          <span className="levels__label">Depth</span>
          {LEVELS.map((l) => {
            const expertLocked = l.id === 'expert' && usage?.plan !== 'pro' && usage?.plan !== 'teams';
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
              {active.meta.preview ? (
                <section className="code-context" aria-label="Selected code context">
                  <div className="code-context__head">
                    <span>Selected code</span>
                    <span>{active.meta.file || active.meta.language || 'Local selection'}</span>
                  </div>
                  <pre><code>{active.meta.preview}</code></pre>
                </section>
              ) : null}
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
              {showText
                ? renderRich(showText, stillTyping)
                : (
                  <div className="skeleton" aria-label="Generating explanation">
                    <span>Reading your selected code…</span>
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
                  className="chip chip--ok"
                  disabled={stillTyping}
                  onClick={() => {
                    window.unvibe.gotIt();
                    toggleCollapse();
                  }}
                >
                  Got it ✓
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
                {active.mock && (
                  <span className="mock-note">mock AI — set ANTHROPIC_API_KEY for real explanations</span>
                )}
              </div>
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
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Widget />);
