/**
 * Overlay B names the selection by its first symbol (`debounce`), as the header title and in Saved. Reads the first
 * few code lines for a declaration or an assignment; null when none reads like one (the caller falls back to
 * "7 lines of JavaScript").
 */
const DECLARATION = /\b(?:function\*?|class|def|fn|func|fun|interface|type|enum|struct|trait|impl|module|const|let|var|val)\s+([A-Za-z_$][\w$]*)/;
const ASSIGNMENT = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:public\s+|private\s+|protected\s+|static\s+)*([A-Za-z_$][\w$.]*)\s*(?:=(?!=)|\(|:(?!:))/;
const NOT_A_NAME = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'else', 'do', 'try', 'await', 'yield', 'new', 'throw', 'case', 'import', 'from', 'export', 'default', 'with', 'elif', 'print']);
const COMMENT = /^(?:\/\/|#|\/\*|\*|--|<!--)/;

export function firstSymbol(code: string | undefined): string | null {
  if (!code) return null;
  const lines = code.split('\n').map((line) => line.trim()).filter((line) => line && !COMMENT.test(line)).slice(0, 8);
  for (const line of lines) {
    const declared = DECLARATION.exec(line)?.[1];
    if (declared && !NOT_A_NAME.has(declared)) return declared;
    const assigned = ASSIGNMENT.exec(line)?.[1];
    if (assigned && !NOT_A_NAME.has(assigned)) return assigned.split('.').pop() ?? assigned;
  }
  return null;
}

/** The first line of code that says something, for the one-line code row. */
export function firstCodeLine(code: string | undefined): string {
  return code?.split('\n').find((line) => line.trim())?.trim() ?? '';
}
