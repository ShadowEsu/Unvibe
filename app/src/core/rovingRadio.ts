export type RadioRovingKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/**
 * Roving-tabindex helper for a horizontal radiogroup. Given the currently
 * selected radio index, the number of radios, and an Arrow/Home/End key,
 * returns the index that should become selected (and focused) next. Wraps
 * around on the edges and skips disabled radios. If every radio is disabled
 * (or the group has a single entry), the current index is kept.
 */
export function nextRadioIndex(
  current: number,
  count: number,
  key: RadioRovingKey,
  isDisabled: (index: number) => boolean = () => false,
): number {
  if (count <= 0) return 0;
  if (key === 'Home') {
    for (let i = 0; i < count; i++) if (!isDisabled(i)) return i;
    return 0;
  }
  if (key === 'End') {
    for (let i = count - 1; i >= 0; i--) if (!isDisabled(i)) return i;
    return count - 1;
  }
  const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  let next = current;
  for (let i = 0; i < count; i++) {
    next = (next + step + count) % count;
    if (!isDisabled(next)) return next;
  }
  return current;
}
