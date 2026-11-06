import { linesLabel } from '../../core/linesLabel';

/** How the panel names a selection's language (ids from core/language.ts). */
const LANGUAGE_NAMES: Record<string, string> = {
  c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go', html: 'HTML', java: 'Java', javascript: 'JavaScript',
  javascriptreact: 'JavaScript', json: 'JSON', 'objective-c': 'Objective-C', 'objective-cpp': 'Objective-C++',
  php: 'PHP', python: 'Python', ruby: 'Ruby', rust: 'Rust', shell: 'shell script', sql: 'SQL', swift: 'Swift',
  typescript: 'TypeScript', typescriptreact: 'TypeScript', yaml: 'YAML',
};

/** The reader-facing name of a language id, or undefined for plain text and ids it does not know. */
export function languageName(language?: string): string | undefined {
  return language ? LANGUAGE_NAMES[language] : undefined;
}

/** The panel header's title: "7 lines of JavaScript", or "7 lines of code" when the language isn't known. */
export function selectionTitle(lines: number, language?: string): string {
  return `${linesLabel(lines)} of ${languageName(language) ?? 'code'}`;
}

/** The line under it: "from Cursor · debounce.js" (the file's name only), or whichever of the two is known. */
export function selectionSource(sourceApp?: string | null, file?: string): string | undefined {
  const name = file?.split(/[\\/]/).pop() || undefined;
  if (sourceApp && name) return `from ${sourceApp} · ${name}`;
  if (sourceApp) return `from ${sourceApp}`;
  return name;
}
