/**
 * Arrow keys in a radio group (WAI-ARIA radio group pattern): Down/Right move to the next enabled option, Up/Left to
 * the previous one, wrapping at the ends; Home/End go to the first/last enabled option. Returns the index to move to,
 * or null when the key isn't one of these or no other option is enabled.
 */
export function radioStep(key: string, from: number, count: number, off: (index: number) => boolean): number | null {
  if (count <= 0) return null;
  let start: number;
  let step: number;
  if (key === 'ArrowDown' || key === 'ArrowRight') { start = from + 1; step = 1; }
  else if (key === 'ArrowUp' || key === 'ArrowLeft') { start = from - 1; step = -1; }
  else if (key === 'Home') { start = 0; step = 1; }
  else if (key === 'End') { start = count - 1; step = -1; }
  else return null;
  const wraps = key.startsWith('Arrow');
  for (let n = 0; n < count; n++) {
    const raw = start + step * n;
    if (!wraps && (raw < 0 || raw >= count)) break;
    const at = ((raw % count) + count) % count;
    if (!off(at)) return at === from && wraps ? null : at;
  }
  return null;
}

/** The option a group's single Tab stop sits on: the preferred one if it's enabled, else the first enabled one. */
export function radioTabStop(preferred: number | null, count: number, off: (index: number) => boolean): number | null {
  if (preferred !== null && preferred >= 0 && preferred < count && !off(preferred)) return preferred;
  for (let i = 0; i < count; i++) if (!off(i)) return i;
  return null;
}
