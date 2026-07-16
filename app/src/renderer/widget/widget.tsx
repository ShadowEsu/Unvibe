import { useEffect, useRef, useState, type ReactNode } from 'react';
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

const LEVELS: Array<{ id: ExplanationLevel; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
];

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
  // [[cite:FILE:LINES]] → chip · `x` → inline code · **x** → bold
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
  // Hide partial markers mid-stream so nothing flickers half-formed.
  let text = raw;
  if (streaming) text = text.replace(/\[\[(?:c(?:i(?:t(?:e(?::[^\]]*)?)?)?)?)?$/, '');

  const nodes: ReactNode[] = [];
  const parts = text.split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // code fence: first line may be the language
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

/* ---------------------------------- app ---------------------------------- */

function prettyAccel(accel: string): string {
  return accel.replace('CommandOrControl', '⌘').replace('Control', '⌃').replace('Shift', '⇧').replace('Alt', '⌥');
}

function Widget() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [meta, setMeta] = useState<{ sourceApp?: string | null; lines?: number; language?: string }>({});
  const [text, setText] = useState('');
  const [level, setLevel] = useState<ExplanationLevel>('intermediate');
  const [findings, setFindings] = useState<SecretFinding[]>([]);
  const [error, setError] = useState('');
  const [mock, setMock] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ask, setAsk] = useState('');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [shortcut, setShortcut] = useState('⌘U');
  const bodyRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    window.unvibe.onReviewEvent((raw) => {
      const ev = raw as WidgetEvent;
      switch (ev.type) {
        case 'init':
          setMeta({ sourceApp: ev.sourceApp, lines: ev.lines, language: ev.language });
          setText('');
          setQuiz(null);
          setPhase(ev.hasCode ? 'ready' : 'empty');
          break;
        case 'status':
          setText('');
          setPhase('streaming');
          break;
        case 'consent':
          setFindings(ev.findings ?? []);
          setPhase('consent');
          break;
        case 'blocked':
          setFindings(ev.findings ?? []);
          setPhase('blocked');
          break;
        case 'token':
          setText((t) => t + (ev.text ?? ''));
          break;
        case 'done':
          setMock(Boolean(ev.mock));
          setPhase('done');
          break;
        case 'error':
          setError(ev.message ?? 'Something went wrong.');
          setPhase('error');
          setQuiz((q) => (q && q.phase !== 'graded' ? null : q));
          break;
        case 'cancelled':
          setText('');
          setQuiz(null);
          setPhase('ready');
          break;
        case 'question':
          setQuiz({ phase: 'answering', question: ev.question, options: ev.options, conceptLabel: ev.conceptLabel });
          break;
        case 'graded':
          setQuiz((q) => (q ? { ...q, phase: 'graded', correct: ev.correct, answerIndex: ev.answerIndex, rationale: ev.rationale } : q));
          break;
      }
    });
    window.unvibe.onAutocollapse((v) => {
      setCollapsed(v);
      window.unvibe.collapse(v);
    });
    window.unvibe.widgetReady();
    window.unvibe.appInfo().then((i) => setShortcut(prettyAccel(i.shortcut)));
  }, []);

  // Autoscroll while streaming.
  useEffect(() => {
    if (phase === 'streaming' && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [text, phase]);

  // Keyboard: ⌘W close · Esc collapse · ⌘1–5 levels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'w') window.unvibe.closeWidget();
      else if (e.key === 'Escape') toggleCollapse();
      else if (e.metaKey && e.key >= '1' && e.key <= '5')

        pick(LEVELS[Number(e.key) - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  const request = (opts: Record<string, unknown>) =>
    window.unvibe.request({ level: levelRef.current, ...opts });

  const pick = (l: ExplanationLevel) => {
    setLevel(l);
    if (phase === 'done') window.unvibe.request({ level: l });
  };

  const toggleCollapse = () => {
    setCollapsed((c) => {
      window.unvibe.collapse(!c);
      return !c;
    });
  };

  const src = meta.lines ? (
    <span className="src">
      <b>{meta.lines} lines</b>
      {meta.language && meta.language !== 'plaintext' ? ` · ${meta.language}` : ''}
      {meta.sourceApp ? ` · from ${meta.sourceApp}` : ''}
    </span>
  ) : (
    <span className="src">
      <b>Unvibe</b>
    </span>
  );

  return (
    <div className="card">
      <div className="head">
        <span className="head__mark" aria-hidden="true"><LogoMark size={14} stroke={2} /></span>
        {src}
        <button className={pinned ? 'on' : ''} aria-label="Pin above everything" onClick={() => { setPinned(!pinned); window.unvibe.pin(!pinned); }}>
          ⌖
        </button>
        <button aria-label={collapsed ? 'Expand' : 'Collapse'} onClick={toggleCollapse}>
          {collapsed ? '▾' : '▴'}
        </button>
        <button aria-label="Close widget" onClick={() => window.unvibe.closeWidget()}>
          ✕
        </button>
      </div>

      {!collapsed && (phase === 'ready' || phase === 'streaming' || phase === 'done' || phase === 'boot') && (
        <div className="levels">
          {LEVELS.map((l) => (
            <button key={l.id} className={`lvl${l.id === level ? ' on' : ''}`} onClick={() => pick(l.id)}>
              {l.label}
            </button>
          ))}
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
              <div className="big">Ready to explain</div>
              <div className="detected">
                <span>{meta.language && meta.language !== 'plaintext' ? meta.language : 'Code selection'}</span>
                <span>{meta.lines ?? 0} lines</span>
                {meta.sourceApp && <span>{meta.sourceApp}</span>}
              </div>
              <div className="sub">Pick a depth above. Unvibe will explain the role, choices, pitfalls, and what changes if this code is removed.</div>
              <button className="btn" onClick={() => request({})}>Explain this code</button>
            </div>
          )}

          {phase === 'empty' && (
            <div className="state">
              <div className="big">Nothing captured</div>
              <div className="sub">
                Select some code first, then press {shortcut}. Or explain what you copied last:
              </div>
              <button className="btn" onClick={() => window.unvibe.useClipboard({ level })}>
                Use clipboard contents
              </button>
            </div>
          )}

          {phase === 'consent' && (
            <div className="state">
              <div className="big">Possible secret detected</div>
              <div className="findings">
                {findings.map((f, i) => (
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
                {findings.map((f, i) => (
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
              <div className="big">Couldn't explain that</div>
              <div className="sub">{error}</div>
              <button className="btn" onClick={() => request({})}>
                Retry
              </button>
            </div>
          )}

          {(phase === 'streaming' || phase === 'done') && !quiz && (
            <div className="body" ref={bodyRef} aria-live="polite" aria-atomic="false">
              {text ? renderRich(text, phase === 'streaming') : <div className="skeleton" aria-label="Generating explanation"><i /><i /><i /></div>}
            </div>
          )}

          {quiz && (phase === 'streaming' || phase === 'done') && (
            <div className="body">
              {quiz.phase === 'loading' && <div className="state"><div className="sub">Writing you a question…</div></div>}
              {quiz.phase !== 'loading' && (
                <div className="quiz">
                  {quiz.conceptLabel && <div className="quiz__concept">{quiz.conceptLabel}</div>}
                  <div className="quiz__q">{quiz.question}</div>
                  <div className="quiz__opts">
                    {quiz.options?.map((o, i) => {
                      const graded = quiz.phase === 'graded';
                      const cls = graded
                        ? i === quiz.answerIndex
                          ? 'opt right'
                          : i === quiz.choice
                            ? 'opt wrong'
                            : 'opt'
                        : i === quiz.choice
                          ? 'opt sel'
                          : 'opt';
                      return (
                        <button
                          key={i}
                          className={cls}
                          disabled={quiz.phase !== 'answering'}
                          onClick={() => setQuiz({ ...quiz, choice: i })}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                  {quiz.phase === 'graded' ? (
                    <>
                      <div className={`verdict ${quiz.correct ? 'ok' : 'no'}`}>
                        {quiz.correct ? 'Correct — that one is understood.' : 'Not quite — saved to revisit.'}
                      </div>
                      {quiz.rationale && <div className="quiz__why">{quiz.rationale}</div>}
                      <button className="btn ghost" onClick={() => setQuiz(null)}>Back to the explanation</button>
                    </>
                  ) : (
                    <div className="quiz__actions">
                      <button
                        className="btn"
                        disabled={quiz.choice === undefined || quiz.phase === 'grading'}
                        onClick={() => {
                          window.unvibe.answer(quiz.choice!);
                          setQuiz({ ...quiz, phase: 'grading' });
                        }}
                      >
                        {quiz.phase === 'grading' ? 'Checking…' : 'Check'}
                      </button>
                      <button className="btn ghost" onClick={() => setQuiz(null)}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(phase === 'streaming' || phase === 'done') && !quiz && (
            <div className="foot">
              <div className="chips">
                {phase === 'streaming' && <button className="chip" onClick={() => window.unvibe.cancel()}>Stop generating</button>}
                <button className="chip" disabled={phase === 'streaming'} onClick={() => window.unvibe.closeWidget()}>
                  Got it ✓
                </button>
                <button className="chip" disabled={phase === 'streaming'} onClick={() => request({ variant: 'different' })}>
                  Explain differently
                </button>
                <button
                  className="chip"
                  disabled={phase === 'streaming'}
                  onClick={() => {
                    setQuiz({ phase: 'loading' });
                    window.unvibe.testMe();
                  }}
                >
                  Test me
                </button>
                {mock && <span className="mock-note">mock AI — set ANTHROPIC_API_KEY for real explanations</span>}
              </div>
              <div className="askrow">
                <input
                  placeholder="Ask a follow-up… (why does this exist? what breaks if I remove it?)"
                  value={ask}
                  disabled={phase === 'streaming'}
                  onChange={(e) => setAsk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && ask.trim()) {
                      request({ question: ask.trim() });
                      setAsk('');
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
