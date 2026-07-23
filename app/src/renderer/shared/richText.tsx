import { useState, type ReactNode } from 'react';

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
          type="button"
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

function citeLabel(file: string, lines: string): string {
  const base = file.split('/').pop() || file;
  const soft = /^(selection|clipboard|untitled|this code|code)$/i.test(base);
  if (soft) return lines.includes('-') ? `lines ${lines.replace('-', '–')}` : `line ${lines}`;
  return `${base}:${lines}`;
}

/** Turn [[cite:...]], **bold**, and `code` into calm inline nodes. Strips leftover bracket junk. */
export function renderInline(text: string): ReactNode[] {
  const cleaned = text
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\[\[(?:cite:)?([^\]]+?)\]\]/gi, (_full, inner: string) => {
      const m = String(inner).match(/^(?:cite:)?(.+?):(\d+(?:-\d+)?)$/i);
      if (!m) return '';
      return `\u0000CITE:${m[1]}:${m[2]}\u0000`;
    });

  const re = /\u0000CITE:([^:\u0000]+):(\d+(?:-\d+)?)\u0000|`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > last) out.push(cleaned.slice(last, m.index));
    if (m[1]) {
      const label = citeLabel(m[1], m[2]!);
      out.push(
        <span key={k++} className="cite" title={label}>
          {label}
        </span>,
      );
    } else if (m[3]) {
      out.push(
        <code key={k++} className="inline">
          {m[3]}
        </code>,
      );
    } else {
      out.push(<strong key={k++}>{m[4]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < cleaned.length) out.push(cleaned.slice(last));
  return out;
}

const LIST_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;

function renderList(lines: string[], key: string): ReactNode {
  const ordered = /^\s*\d+[.)]\s+/.test(lines[0] ?? '');
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag key={key} className="rich-list">
      {lines.map((line, i) => (
        <li key={`${key}-${i}`}>{renderInline(line.replace(LIST_RE, ''))}</li>
      ))}
    </Tag>
  );
}

function renderTextBlock(block: string, key: string): ReactNode[] {
  const lines = block.split('\n').map((l) => l.replace(/\s+$/, ''));
  const nodes: ReactNode[] = [];
  let i = 0;
  let p = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i]!.trim() === '') i += 1;
    if (i >= lines.length) break;
    if (LIST_RE.test(lines[i]!)) {
      const group: string[] = [];
      while (i < lines.length && (LIST_RE.test(lines[i]!) || (group.length && lines[i]!.startsWith('  ') && lines[i]!.trim()))) {
        if (LIST_RE.test(lines[i]!)) group.push(lines[i]!);
        else group[group.length - 1] = `${group[group.length - 1]} ${lines[i]!.trim()}`;
        i += 1;
      }
      nodes.push(renderList(group, `${key}-l${p++}`));
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== '' && !LIST_RE.test(lines[i]!)) {
      para.push(lines[i]!.trim());
      i += 1;
    }
    const joined = para.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) nodes.push(<p key={`${key}-p${p++}`}>{renderInline(joined)}</p>);
  }
  return nodes;
}

/** Markdown-ish body: lists, bold, inline code, fenced blocks, calm citation chips. */
export function renderRich(raw: string, streaming = false): ReactNode[] {
  let text = raw.replace(/\r\n/g, '\n');
  if (streaming) {
    text = text
      .replace(/\[\[(?:c(?:i(?:t(?:e(?::[^\]]*)?)?)?)?)?$/, '')
      .replace(/\{\{[^}]*$/, '');
  }

  const nodes: ReactNode[] = [];
  const parts = text.split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf('\n');
      const lang = nl === -1 ? '' : part.slice(0, nl).trim();
      const code = nl === -1 ? part : part.slice(nl + 1);
      nodes.push(<CodeBlock key={`cb${i}`} lang={lang} code={code.replace(/\n$/, '')} />);
    } else {
      nodes.push(...renderTextBlock(part, `t${i}`));
    }
  });
  if (streaming) nodes.push(<span key="cur" className="cursor" />);
  return nodes;
}

export function RichText({ text, streaming = false, className }: { text: string; streaming?: boolean; className?: string }) {
  if (!text.trim()) return null;
  return <div className={className ? `rich-text ${className}` : 'rich-text'}>{renderRich(text, streaming)}</div>;
}
