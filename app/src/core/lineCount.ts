/**
 * How many lines a selection has, as a person counts them: a trailing newline (a terminal's or an editor's whole-line
 * copy ends with one) does not add an empty line. Never under 1. The code itself is not trimmed; only the count is.
 */
export function lineCount(code: string): number {
  return Math.max(1, code.replace(/\r?\n$/, '').split('\n').length);
}
