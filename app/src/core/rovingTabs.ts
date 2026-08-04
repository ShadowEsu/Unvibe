export type RovingKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/**
 * Roving-tabindex helper for a horizontal tablist. Given the currently active
 * tab index, the number of tabs, and an Arrow/Home/End key, returns the index
 * that should become active (and focused) next. Wraps around on the edges.
 */
export function nextRovingIndex(current: number, count: number, key: RovingKey): number {
  if (count <= 0) return 0;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowRight' ? 1 : -1;
  return (current + step + count) % count;
}
