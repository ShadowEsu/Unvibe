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

/** Counts words across one render, so a word keeps its key (and plays its fade once) as the answer grows. */
type WordCounter = { n: number };

/** A token with a letter or digit; one without (`|`, `-`, `→`, `…`) is punctuation and never fades on its own. */
export const HAS_WORD = /[\p{L}\p{N}]/u;

/**
 * Each word as a `span.rich-w` keyed by its place in the answer; whitespace between words stays plain text (SPEC §6
 * word fade). A punctuation-only token joins the word before it, or, with none before it, the word after it, so it
 * arrives with that word (Motion, app-0151: a row of table pipes no longer fades in as a burst of "words").
 */
function wrapWords(text: string, words: WordCounter): ReactNode[] {
  const out: ReactNode[] = [];
  let unit: string | null = null;
  let unitHasWord = false;
  let gap = '';
  const flush = () => {
    if (unit !== null) out.push(<span key={`w${words.n++}`} className="rich-w">{unit}</span>);
    if (gap) out.push(gap);
    unit = null;
    gap = '';
  };
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s/.test(part)) {
      if (unit === null) out.push(part);
      else gap = part;
      continue;
    }
    const word = HAS_WORD.test(part);
    if (unit !== null && (!word || !unitHasWord)) {
      unit += gap + part;
      gap = '';
      unitHasWord ||= word;
      continue;
    }
    flush();
    unit = part;
    unitHasWord = word;
  }
  flush();
  return out;
}

/** Turn [[cite:...]], **bold**, and `code` into calm inline nodes. Strips leftover bracket junk. With `words`, plain words fade in one by one. */
export function renderInline(text: string, words?: WordCounter): ReactNode[] {
  const cleaned = text
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\[\[(?:cite:)?([^\]]+?)\]\]/gi, (_full, inner: string) => {
      const m = String(inner).match(/^(?:cite:)?(.+?):(\d+(?:-\d+)?)$/i);
      if (!m) return '';
      return `\u0000CITE:${m[1]}:${m[2]}\u0000`;
    });

  // Bold text may hold code spans, and a code span may hold `*` (e.g. **`n * n`**); a bare `*` still ends
  // the match, so the inner renderInline pass can't find bold again. The two alternatives share no
  // character (a backtick only opens a code span), so a failed match stays linear on long streamed lines.
  const re = /\u0000CITE:([^:\u0000]+):(\d+(?:-\d+)?)\u0000|`([^`\n]+)`|\*\*((?:`[^`\n]+`|[^*`\n])+)\*\*/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > last) out.push(...(words ? wrapWords(cleaned.slice(last, m.index), words) : [cleaned.slice(last, m.index)]));
    if (m[1]) {
      const label = citeLabel(m[1], m[2]!);
      out.push(
        <span key={k++} className={words ? 'cite rich-w' : 'cite'} title={label}>
          {label}
        </span>,
      );
    } else if (m[3]) {
      out.push(
        <code key={k++} className={words ? 'inline rich-w' : 'inline'}>
          {m[3]}
        </code>,
      );
    } else {
      // A bold label can hold inline code (e.g. **The check (`!user`):**); render its inside too, word by word.
      out.push(<strong key={k++}>{renderInline(m[4]!, words)}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < cleaned.length) out.push(...(words ? wrapWords(cleaned.slice(last), words) : [cleaned.slice(last)]));
  return out;
}

/**
 * A one-line preview of a saved explanation (Briefs' Saved knowledge): headings and line breaks are
 * flattened, then citations, bold and code render as inline nodes, so no raw `##` or `[[cite:…]]` shows.
 */
export function renderSummary(text: string): ReactNode[] {
  return renderInline(text.replace(/^\s*#{1,6}\s+/gm, '').replace(/\s*\n+\s*/g, ' ').trim());
}

const LIST_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;
const HEADING_RE = /^\s*(#{1,6})\s+(.+?)\s*$/;

function renderList(lines: string[], key: string, words?: WordCounter): ReactNode {
  const ordered = /^\s*\d+[.)]\s+/.test(lines[0] ?? '');
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag key={key} className="rich-list">
      {lines.map((line, i) => (
        <li key={`${key}-${i}`}>{renderInline(line.replace(LIST_RE, ''), words)}</li>
      ))}
    </Tag>
  );
}

type Align = 'left' | 'center' | 'right' | null;

/**
 * One table row's cells. The outer pipes are optional and `\|` is a literal pipe. A pipe inside a code
 * span stays in its cell (answers write `a || b` there); if the row's backticks don't pair up, every
 * pipe splits instead, so one stray backtick can't swallow the rest of the row.
 */
function tableCells(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const split = (codeAware: boolean): { cells: string[]; open: boolean } => {
    const cells: string[] = [];
    let cell = '';
    let inCode = false;
    for (let j = 0; j < row.length; j += 1) {
      const ch = row[j]!;
      if (ch === '\\' && row[j + 1] === '|') { cell += '|'; j += 1; continue; }
      if (ch === '`') inCode = !inCode;
      if (ch === '|' && !(codeAware && inCode)) { cells.push(cell.trim()); cell = ''; continue; }
      cell += ch;
    }
    cells.push(cell.trim());
    return { cells, open: inCode };
  };
  const aware = split(true);
  return aware.open ? split(false).cells : aware.cells;
}

/**
 * The column alignments when `line` is a table's `|---|:--:|` separator for `columns` header cells. The
 * separator needs a pipe too, so prose above a bare `---` (or a list's lone `-` mid-stream) isn't a table.
 */
function tableAligns(line: string | undefined, columns: number): Align[] | null {
  if (!line || !line.includes('-') || !line.includes('|')) return null;
  const cells = tableCells(line);
  if (cells.length !== columns || !cells.every((cell) => /^:?-+:?$/.test(cell))) return null;
  return cells.map((cell) => (cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : cell.startsWith(':') ? 'left' : null));
}

/** A table starts at `i`: a line with a pipe (not a heading or list item), then a separator with the same number of cells. */
function tableAt(lines: string[], i: number): { header: string[]; aligns: Align[] } | null {
  const line = lines[i]!;
  if (!line.includes('|') || HEADING_RE.test(line) || LIST_RE.test(line)) return null;
  const header = tableCells(line);
  const aligns = tableAligns(lines[i + 1], header.length);
  return aligns ? { header, aligns } : null;
}

function renderTable(header: string[], aligns: Align[], rows: string[][], key: string): ReactNode {
  const cls = (c: number) => (aligns[c] ? `is-${aligns[c]}` : undefined);
  return (
    // Wide tables scroll sideways inside a narrow panel; the region is focusable so the keyboard can scroll it.
    <div key={key} className="rich-table" role="region" aria-label={`Table: ${header.join(', ').replace(/[`*]/g, '')}`} tabIndex={0}>
      <table>
        <thead>
          <tr>{header.map((cell, c) => <th key={c} scope="col" className={cls(c)}>{renderInline(cell)}</th>)}</tr>
        </thead>
        {rows.length ? (
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>{header.map((_, c) => <td key={c} className={cls(c)}>{renderInline(row[c] ?? '')}</td>)}</tr>
            ))}
          </tbody>
        ) : null}
      </table>
    </div>
  );
}

function renderTextBlock(block: string, key: string, words?: WordCounter): ReactNode[] {
  const lines = block.split('\n').map((l) => l.replace(/\s+$/, ''));
  const nodes: ReactNode[] = [];
  let i = 0;
  let p = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i]!.trim() === '') i += 1;
    if (i >= lines.length) break;
    const heading = lines[i]!.match(HEADING_RE);
    if (heading) {
      const depth = Math.min(4, Math.max(2, heading[1]!.length)) as 2 | 3 | 4;
      const Heading = `h${depth}` as 'h2' | 'h3' | 'h4';
      nodes.push(<Heading key={`${key}-h${p++}`} className={`rich-heading rich-heading--${depth}`}>{renderInline(heading[2]!, words)}</Heading>);
      i += 1;
      continue;
    }
    const table = tableAt(lines, i);
    if (table) {
      const rows: string[][] = [];
      i += 2;
      // Rows run until a blank line, a heading or a list item (a "- a | b" bullet right under a table is a list).
      while (i < lines.length && lines[i]!.trim() !== '' && lines[i]!.includes('|') && !HEADING_RE.test(lines[i]!) && !LIST_RE.test(lines[i]!)) {
        rows.push(tableCells(lines[i]!));
        i += 1;
      }
      nodes.push(renderTable(table.header, table.aligns, rows, `${key}-t${p++}`));
      continue;
    }
    if (LIST_RE.test(lines[i]!)) {
      const group: string[] = [];
      while (i < lines.length && (LIST_RE.test(lines[i]!) || (group.length && lines[i]!.startsWith('  ') && lines[i]!.trim()))) {
        if (LIST_RE.test(lines[i]!)) group.push(lines[i]!);
        else group[group.length - 1] = `${group[group.length - 1]} ${lines[i]!.trim()}`;
        i += 1;
      }
      nodes.push(renderList(group, `${key}-l${p++}`, words));
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== '' && !LIST_RE.test(lines[i]!) && !HEADING_RE.test(lines[i]!) && !(para.length && tableAt(lines, i))) {
      para.push(lines[i]!.trim());
      i += 1;
    }
    const joined = para.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) nodes.push(<p key={`${key}-p${p++}`}>{renderInline(joined, words)}</p>);
  }
  return nodes;
}

/**
 * While an answer streams, its last line can end inside `code` or **bold** whose closing marker hasn't
 * arrived. Close it so it renders as code/bold now instead of flashing raw markers; an opener with nothing
 * after it yet is dropped. Earlier lines are complete, so a lone marker there stays literal. Inside an
 * open fenced block nothing changes.
 */
function closeStreamingMarkers(text: string): string {
  if ((text.match(/```/g) ?? []).length % 2 === 1) return text;
  const nl = text.lastIndexOf('\n');
  const head = text.slice(0, nl + 1);
  let line = text.slice(nl + 1);
  const tick = (line.match(/`/g) ?? []).length % 2 === 1 ? line.lastIndexOf('`') : -1;
  const bold = (line.match(/\*\*/g) ?? []).length % 2 === 1 ? line.lastIndexOf('**') : -1;
  let close = '';
  if (tick >= 0) {
    if (line.slice(tick + 1).trim()) close += '`';
    else line = line.slice(0, tick);
  }
  // An opener after an open backtick sits inside the code span, so it isn't bold.
  if (bold >= 0 && (tick < 0 || bold < tick)) {
    if (line.slice(bold + 2).trim()) close += '**';
    else line = line.slice(0, bold);
  }
  return head + line + close;
}

/**
 * Markdown-ish body: headings, lists, tables, bold, inline code, fenced blocks, calm citation chips. With `words`, each
 * word of the last text part (after the last fence; earlier parts are finished) is a keyed span that fades in as it
 * arrives (SPEC §6). Table cells don't fade by word.
 */
export function renderRich(raw: string, streaming = false, opts?: { words?: boolean }): ReactNode[] {
  let text = raw.replace(/\r\n/g, '\n');
  if (streaming) {
    text = text
      .replace(/\[\[(?:c(?:i(?:t(?:e(?::[^\]]*)?)?)?)?)?$/, '')
      .replace(/\{\{[^}]*$/, '')
      .replace(/(^|\n)#{1,6}\s*$/, '$1');
    text = closeStreamingMarkers(text);
  }

  const nodes: ReactNode[] = [];
  const words = opts?.words ? { n: 0 } : undefined;
  const parts = text.split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf('\n');
      const lang = nl === -1 ? '' : part.slice(0, nl).trim();
      const code = nl === -1 ? part : part.slice(nl + 1);
      nodes.push(<CodeBlock key={`cb${i}`} lang={lang} code={code.replace(/\n$/, '')} />);
    } else {
      nodes.push(...renderTextBlock(part, `t${i}`, i === parts.length - 1 ? words : undefined));
    }
  });
  if (streaming) nodes.push(<span key="cur" className="cursor" />);
  return nodes;
}

export function RichText({ text, streaming = false, className }: { text: string; streaming?: boolean; className?: string }) {
  if (!text.trim()) return null;
  return <div className={className ? `rich-text ${className}` : 'rich-text'}>{renderRich(text, streaming)}</div>;
}
