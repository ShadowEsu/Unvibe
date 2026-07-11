/** Crude content-based language guess for captured selections (no file path available). */
export function guessLanguage(code: string): string {
  if (/^\s*#include\b|::\w+\(|std::/m.test(code)) return 'cpp';
  if (/\bfn\s+\w+\s*\(|\blet\s+mut\b|::<|\bimpl\b/.test(code)) return 'rust';
  if (/\bdef\s+\w+\s*\(|\bimport\s+\w+$|\bself\b/m.test(code)) return 'python';
  if (/\bfunc\s+\w+\s*\(|\bpackage\s+\w+$/m.test(code)) return 'go';
  if (/\binterface\s+\w+|:\s*(string|number|boolean)\b|\bas\s+const\b/.test(code)) return 'typescript';
  if (/\bconst\s|\bfunction\b|=>|\brequire\(/.test(code)) return 'javascript';
  if (/\bSELECT\b.*\bFROM\b/is.test(code)) return 'sql';
  if (/<\/?[a-z][\s\S]*>/i.test(code) && /<\/(div|span|p|html|body)>/i.test(code)) return 'html';
  if (/^\s*\{[\s\S]*\}\s*$/.test(code) && /"\w+"\s*:/.test(code)) return 'json';
  return 'plaintext';
}
