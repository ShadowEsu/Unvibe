import path from 'node:path';

const languageByExtension: Record<string, string> = {
  c: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', h: 'cpp', hh: 'cpp', hpp: 'cpp', hxx: 'cpp',
  cs: 'csharp', go: 'go', java: 'java', js: 'javascript', jsx: 'javascriptreact',
  json: 'json', m: 'objective-c', mm: 'objective-cpp', php: 'php', py: 'python', rb: 'ruby',
  rs: 'rust', sh: 'shell', sql: 'sql', swift: 'swift', ts: 'typescript', tsx: 'typescriptreact',
  yaml: 'yaml', yml: 'yaml', zsh: 'shell',
};

export interface LanguageDetection {
  language: string;
  source: 'file-path' | 'content' | 'unknown';
}

/** Prefer the selected document's extension over inference from a partial snippet. */
export function detectLanguage(code: string, filePath?: string): LanguageDetection {
  const extension = filePath ? path.extname(filePath).slice(1).toLowerCase() : '';
  const fromPath = extension ? languageByExtension[extension] : undefined;
  if (fromPath) return { language: fromPath, source: 'file-path' };

  const fromContent = detectLanguageFromContent(code);
  if (fromContent) return { language: fromContent, source: 'content' };
  return { language: 'unknown', source: 'unknown' };
}

/** Content-only fallback for captures that have no editor metadata. */
export function guessLanguage(code: string): string {
  const detected = detectLanguageFromContent(code);
  return detected ?? 'unknown';
}

/**
 * C++ signals, checked before the other rules. Code written with `using namespace std`
 * has no `std::` or `#include`, and `const vector<int>&` would otherwise match the
 * JavaScript `const` rule. Each alternative is absent from JS, TS, Java, C# and Rust:
 * keywords, lowercase STL containers used as types (TS/Java/C# write `Map<`, `List<`),
 * access specifiers alone on a line, and `const T&` reference parameters.
 */
const cppPattern = new RegExp([
  String.raw`^\s*#include\b|::\w+\(|std::`,
  String.raw`\b(?:constexpr|nullptr|using\s+namespace)\b|\btemplate\s*<|\bcout\s*<<|\bcin\s*>>`,
  String.raw`\b(?:vector|unordered_map|unordered_set|map|set|deque|unique_ptr|shared_ptr)<`,
  String.raw`^\s*(?:public|private|protected)\s*:\s*$`,
  String.raw`\bconst\s+[\w:]+(?:<[^<>;=]*>)?\s*&\s*\w`,
].join('|'), 'm');

/**
 * TypeScript signals, none of them valid JavaScript: an interface, `as const`, a type annotation of a built-in type
 * (`: unknown`, `let n: number`), a generic function (`function withRetry<T>(`), a return type of a generic utility
 * type (`): Promise<T>`), and type arguments on a constructor after const/let (`new Map<string, number>(`; `var`
 * is left out, C# writes `var xs = new List<int>()`). Pasted code has no file name, so these are all there is
 * (Marketing's 6 Nov report: withRetry<T> with `: unknown` and `Promise<T>` was labelled javascript).
 */
const typescriptPattern = new RegExp([
  String.raw`\binterface\s+\w+|\bas\s+const\b`,
  String.raw`:\s*(?:string|number|boolean|unknown|any|void|never|bigint)\b`,
  String.raw`\bfunction\b[^(\n]*<\w[^>\n]*>\s*\(`,
  String.raw`\)\s*:\s*(?:Promise|Array|Record|Map|Set|Partial|Readonly|ReadonlyArray)<`,
  String.raw`\b(?:const|let)\s+\w+\s*=\s*new\s+\w+<[^<>\n]+>\s*\(`,
].join('|'));

function detectLanguageFromContent(code: string): string | null {
  if (cppPattern.test(code)) return 'cpp';
  if (/\bfn\s+\w+\s*\(|\blet\s+mut\b|::<|\bimpl\b/.test(code)) return 'rust';
  if (/\bdef\s+\w+\s*\(|\bimport\s+\w+$|\bself\b/m.test(code)) return 'python';
  if (/\bfunc\s+\w+\s*\(|\bpackage\s+\w+$/m.test(code)) return 'go';
  if (typescriptPattern.test(code)) return 'typescript';
  if (/\bconst\s|\bfunction\b|=>|\brequire\(/.test(code)) return 'javascript';
  if (/\bSELECT\b.*\bFROM\b/is.test(code)) return 'sql';
  if (/<\/?[a-z][\s\S]*>/i.test(code) && /<\/(div|span|p|html|body)>/i.test(code)) return 'html';
  if (/^\s*\{[\s\S]*\}\s*$/.test(code) && /"\w+"\s*:/.test(code)) return 'json';
  return null;
}
