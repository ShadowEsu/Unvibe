import type { CSSProperties } from 'react';
import { useMemo } from 'react';

/**
 * The contained celebration (Design r2 motion row 14): eight 8–10 px shapes in violet and lilac fly out from the
 * centre over 900 ms and fade, clipped to the card that holds them, once per `trigger` per day (localStorage).
 * Transform and opacity only; nothing under reduced motion (the CSS turns the animation off).
 */
export function Burst({ trigger }: { trigger: string }) {
  const show = useMemo(() => {
    const key = `unvibe.burst.${trigger}.${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(key)) return false;
      localStorage.setItem(key, '1');
    } catch {
      return false;
    }
    return true;
  }, [trigger]);
  if (!show) return null;
  return (
    <span className="m-burst" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
    </span>
  );
}
