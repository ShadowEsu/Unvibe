/** Pure parsing helpers used by the context builder. Unit tested. */

const IMPORT_PATTERNS = [
  /^\s*import\s.+/, // JS/TS
  /^\s*export\s+.*\sfrom\s+['"].+['"]/, // re-export
  /^\s*const\s+.+=\s*require\(['"].+['"]\)/, // CommonJS
  /^\s*from\s+\S+\s+import\s.+/, // Python
  /^\s*import\s+\S+/, // Python/Go single
  /^\s*#include\s+[<"].+[>"]/, // C/C++
  /^\s*using\s+[\w.]+;/, // C#
  /^\s*use\s+[\w:]+;/, // Rust
];

/** Extract import-like lines from source, de-duplicated and capped. */
export function extractImports(source: string, max = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (IMPORT_PATTERNS.some((re) => re.test(line))) {
      const key = line.trim();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
        if (out.length >= max) {
          break;
        }
      }
    }
  }
  return out;
}

const EXT_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  rb: 'ruby',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
};

/** Best-effort language name from a file path. */
export function detectLanguage(fsPath: string | undefined): string {
  if (!fsPath) {
    return 'unknown';
  }
  const dot = fsPath.lastIndexOf('.');
  if (dot < 0) {
    return 'unknown';
  }
  const ext = fsPath.slice(dot + 1).toLowerCase();
  return EXT_LANGUAGE[ext] ?? ext;
}
