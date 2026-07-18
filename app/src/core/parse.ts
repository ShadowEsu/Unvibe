/** Pure parsing helpers for nearby-file context. */

const IMPORT_PATTERNS = [
  /^\s*import\s.+/,
  /^\s*export\s+.*\sfrom\s+['"].+['"]/,
  /^\s*const\s+.+=\s*require\(['"].+['"]\)/,
  /^\s*from\s+\S+\s+import\s.+/,
  /^\s*import\s+\S+/,
  /^\s*#include\s+[<"].+[>"]/,
  /^\s*using\s+[\w.]+;/,
  /^\s*use\s+[\w:]+;/,
];

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
        if (out.length >= max) break;
      }
    }
  }
  return out;
}

/** Pull relative module paths from common JS/TS import lines. */
export function relativeImportPaths(importLines: string[], max = 6): string[] {
  const out: string[] = [];
  for (const line of importLines) {
    const m = /['"](\.[^'"]+)['"]/.exec(line);
    if (!m) continue;
    out.push(m[1]!);
    if (out.length >= max) break;
  }
  return out;
}
