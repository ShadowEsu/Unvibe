export type TabArrowKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/**
 * Roving-tabindex helper for the ARIA tabs pattern. Given the currently
 * focused tab index, the number of tabs, and an arrow/Home/End key, returns
 * the index that should become focused next. Wraps around on the edges.
 */
export function nextTabIndex(current: number, count: number, key: TabArrowKey): number {
  if (count <= 0) return 0;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowRight' ? 1 : -1;
  return (current + step + count) % count;
}
