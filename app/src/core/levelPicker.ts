export type LevelPickerKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/**
 * Roving-tabindex helper for the widget's explanation-depth radiogroup.
 * Given the currently active level index, the number of levels, and an
 * Arrow/Home/End key, returns the index that should become active (and
 * focused) next. Wraps around on the edges and skips locked levels. If every
 * level is locked (or the list has a single entry), the current index is kept.
 */
export function nextLevelIndex(
  current: number,
  count: number,
  key: LevelPickerKey,
  isLocked: (index: number) => boolean = () => false,
): number {
  if (count <= 0) return 0;
  if (key === 'Home') {
    for (let i = 0; i < count; i++) if (!isLocked(i)) return i;
    return 0;
  }
  if (key === 'End') {
    for (let i = count - 1; i >= 0; i--) if (!isLocked(i)) return i;
    return count - 1;
  }
  const step = key === 'ArrowLeft' ? -1 : 1;
  let next = current;
  for (let i = 0; i < count; i++) {
    next = (next + step + count) % count;
    if (!isLocked(next)) return next;
  }
  return current;
}
