export type QuizPickerKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/**
 * Roving-tabindex helper for the widget's "Test me" answer-options
 * radiogroup. Given the currently selected answer index (-1 when nothing is
 * selected yet), the number of options, and an Arrow/Home/End key, returns
 * the index that should become selected (and focused) next. Wraps around on
 * the edges and guards empty lists. Quiz options are never individually
 * locked while answering, so no skip-list is needed.
 */
export function nextQuizOptionIndex(current: number, count: number, key: QuizPickerKey): number {
  if (count <= 0) return 0;
  if (current < 0) return key === 'ArrowUp' || key === 'End' ? count - 1 : 0;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowDown' ? 1 : -1;
  return (current + step + count) % count;
}
