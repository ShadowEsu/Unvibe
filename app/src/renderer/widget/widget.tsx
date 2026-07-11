import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { WidgetEvent } from '../../main/review';
import type { ExplanationLevel } from '../../core/protocol';
import type { SecretFinding } from '../../core/secretFilter';

type Phase = 'boot' | 'empty' | 'consent' | 'blocked' | 'streaming' | 'done' | 'error';

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
  const bodyRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    window.unvibe.onReviewEvent((raw) => {
      const ev = raw as WidgetEvent;
      switch (ev.type) {
        case 'init':
          setMeta({ sourceApp: ev.sourceApp, lines: ev.lines, language: ev.language });
          if (!ev.hasCode) setPhase('empty');
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
          break;
      }
    });
    window.unvibe.widgetReady();
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
    window.unvibe.request({ level: l });
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
        {src}
        <button className={pinned ? 'on' : ''} title="Pin above everything" onClick={() => { setPinned(!pinned); window.unvibe.pin(!pinned); }}>
          ⌖
        </button>
        <button title="Collapse (Esc)" onClick={toggleCollapse}>
          {collapsed ? '▾' : '▴'}
        </button>
        <button title="Close (⌘W)" onClick={() => window.unvibe.closeWidget()}>
          ✕
        </button>
      </div>

      {!collapsed && (phase === 'streaming' || phase === 'done' || phase === 'boot') && (
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

          {phase === 'empty' && (
            <div className="state">
              <div className="big">Nothing captured</div>
              <div className="sub">
                Select some code first, then press ⌥ Space. Or explain what you copied last:
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

          {(phase === 'streaming' || phase === 'done') && (
            <div className="body" ref={bodyRef}>
              {renderRich(text, phase === 'streaming')}
            </div>
          )}

          {(phase === 'streaming' || phase === 'done') && (
            <div className="foot">
              <div className="chips">
                <button className="chip" disabled={phase === 'streaming'} onClick={() => window.unvibe.closeWidget()}>
                  Got it ✓
                </button>
                <button className="chip" disabled={phase === 'streaming'} onClick={() => request({ variant: 'different' })}>
                  Explain differently
                </button>
                <button className="chip" disabled title="Coming in Milestone D2">
                  Test me<span className="soon">D2</span>
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
