/**
 * The error pulses that show their own word on the Island (Design on backlog P7): a limit, an empty selection and a
 * blocked send each say what happened, with the amber dot. Any other error says "Issue"; offline says "Offline".
 * The words are short enough for the Mac notch at its smallest size, clear of the camera housing (Design: one set
 * for every size and both systems).
 */
export const PROBLEM_WORDS: readonly string[] = ['Limit', 'Select code', 'Blocked'];

export function problemWord(phase: 'error' | 'offline', label: string | undefined): string {
  if (phase === 'offline') return 'Offline';
  return label !== undefined && PROBLEM_WORDS.includes(label) ? label : 'Issue';
}
