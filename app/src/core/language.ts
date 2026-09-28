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

function detectLanguageFromContent(code: string): string | null {
  if (/^\s*#include\b|::\w+\(|std::/m.test(code)) return 'cpp';
  if (/\bfn\s+\w+\s*\(|\blet\s+mut\b|::<|\bimpl\b/.test(code)) return 'rust';
  if (/\bdef\s+\w+\s*\(|\bimport\s+\w+$|\bself\b/m.test(code)) return 'python';
  if (/\bfunc\s+\w+\s*\(|\bpackage\s+\w+$/m.test(code)) return 'go';
  if (/\binterface\s+\w+|:\s*(string|number|boolean)\b|\bas\s+const\b/.test(code)) return 'typescript';
  if (/\bconst\s|\bfunction\b|=>|\brequire\(/.test(code)) return 'javascript';
  if (/\bSELECT\b.*\bFROM\b/is.test(code)) return 'sql';
  if (/<\/?[a-z][\s\S]*>/i.test(code) && /<\/(div|span|p|html|body)>/i.test(code)) return 'html';
  if (/^\s*\{[\s\S]*\}\s*$/.test(code) && /"\w+"\s*:/.test(code)) return 'json';
  return null;
}
