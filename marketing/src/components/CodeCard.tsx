import { Fragment } from "react";
import { cn } from "@/lib/utils";

/*
  Lightweight, dependency-free code renderer.

  This is not a full syntax highlighter — it applies a small, safe token pass over
  curated static snippets so code reads as code (keywords, strings, comments, numbers,
  functions). All content rendered here is authored by us, never user input, so there
  is no untrusted HTML. Colors come from theme tokens, used sparingly.
*/

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "async", "await", "import", "export", "from", "class", "interface", "type",
  "extends", "implements", "new", "typeof", "instanceof", "in", "of", "null",
  "undefined", "true", "false", "void", "public", "private", "static", "def",
  "self", "None", "True", "False", "raise", "and", "or", "not", "select",
  "from", "left", "join", "on", "group", "by", "order", "desc", "asc", "where",
  "count", "as", "int", "str", "float", "bool", "fn", "let", "match", "pub",
  "struct", "enum", "trait", "impl", "go", "func", "package", "var", "map",
]);

interface Token {
  text: string;
  kind: "kw" | "str" | "com" | "num" | "fn" | "punc" | "text";
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = line.length;

  const isWordChar = (c: string) => /[A-Za-z0-9_$]/.test(c);

  while (i < n) {
    const c = line[i];

    // Line comments: // ... or # ... or -- ...
    if (
      (c === "/" && line[i + 1] === "/") ||
      c === "#" ||
      (c === "-" && line[i + 1] === "-")
    ) {
      tokens.push({ text: line.slice(i), kind: "com" });
      break;
    }

    // Strings
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && line[j] !== c) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push({ text: line.slice(i, Math.min(j + 1, n)), kind: "str" });
      i = j + 1;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9._]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), kind: "num" });
      i = j;
      continue;
    }

    // Words (keywords, function calls, identifiers)
    if (isWordChar(c)) {
      let j = i;
      while (j < n && isWordChar(line[j])) j++;
      const word = line.slice(i, j);
      const next = line[j];
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, kind: "kw" });
      } else if (next === "(") {
        tokens.push({ text: word, kind: "fn" });
      } else {
        tokens.push({ text: word, kind: "text" });
      }
      i = j;
      continue;
    }

    // Punctuation / whitespace run
    let j = i;
    while (j < n && !isWordChar(line[j]) && !/["'`]/.test(line[j])) {
      // stop if a comment starts
      if (
        (line[j] === "/" && line[j + 1] === "/") ||
        line[j] === "#" ||
        (line[j] === "-" && line[j + 1] === "-")
      )
        break;
      j++;
    }
    const chunk = line.slice(i, j || i + 1);
    tokens.push({
      text: chunk,
      kind: /[{}()[\].,;:=<>+\-*/&|!?]/.test(chunk.trim()) ? "punc" : "text",
    });
    i += chunk.length || 1;
  }

  return tokens;
}

const tokenClass: Record<Token["kind"], string> = {
  kw: "text-primary",
  str: "text-green",
  com: "text-fg-faint italic",
  num: "text-orange",
  fn: "text-blue",
  punc: "text-fg-muted",
  text: "text-fg",
};

interface CodeCardProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
  /** Highlight these 1-based line numbers as changed/added. */
  addedLines?: number[];
  removedLines?: number[];
}

export function CodeCard({
  code,
  language,
  filename,
  showLineNumbers = true,
  className,
  addedLines = [],
  removedLines = [],
}: CodeCardProps) {
  const lines = code.replace(/\n$/, "").split("\n");
  const added = new Set(addedLines);
  const removed = new Set(removedLines);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-line bg-surface font-mono text-[0.82rem] leading-[1.7]",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        </span>
        {filename && (
          <span className="ml-1 text-[0.72rem] font-sans text-fg-muted">
            {filename}
          </span>
        )}
        {language && !filename && (
          <span className="ml-1 text-[0.72rem] font-sans uppercase tracking-wide text-fg-faint">
            {language}
          </span>
        )}
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="block">
          {lines.map((line, idx) => {
            const lineNo = idx + 1;
            const isAdded = added.has(lineNo);
            const isRemoved = removed.has(lineNo);
            return (
              <span
                key={idx}
                className={cn(
                  "grid grid-cols-[auto_1fr] gap-4",
                  isAdded && "-mx-4 bg-green/10 px-4",
                  isRemoved && "-mx-4 bg-red/10 px-4 opacity-70"
                )}
              >
                {showLineNumbers && (
                  <span className="select-none text-right text-fg-faint/70">
                    {lineNo}
                  </span>
                )}
                <span className="whitespace-pre">
                  {line.length === 0 ? (
                    " "
                  ) : (
                    tokenizeLine(line).map((tok, ti) => (
                      <Fragment key={ti}>
                        <span className={tokenClass[tok.kind]}>{tok.text}</span>
                      </Fragment>
                    ))
                  )}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
