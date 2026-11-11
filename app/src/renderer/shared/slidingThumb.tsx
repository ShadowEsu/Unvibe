import { useLayoutEffect, useRef } from 'react';

/**
 * The sliding thumbs of Design's motion layer (r2-motion SPEC §3 rows 2 and 9): one absolutely positioned element
 * inside a nav or segmented control that moves to the selected sibling with a transform (app-0151.css `.nav-pill`,
 * `.seg-thumb`). It measures the sibling marked `.on`, `.is-on`, `[aria-current]`, `[aria-pressed="true"]`, `[aria-checked="true"]` or
 * `[aria-selected="true"]` on every render and on resize, and hides when none is selected. The thumb is decorative
 * (pointer-events none, aria-hidden); the buttons keep their own semantics.
 */
function useThumb(axis: 'y' | 'x') {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const place = () => {
      const on = parent.querySelector<HTMLElement>(':scope > .on, :scope > .is-on, :scope > [aria-current], :scope > [aria-pressed="true"], :scope > [aria-selected="true"], :scope > [aria-checked="true"]');
      if (!on) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      if (axis === 'y') {
        el.style.setProperty('--pill-y', `${on.offsetTop}px`);
        el.style.setProperty('--pill-h', `${on.offsetHeight}px`);
      } else {
        el.style.setProperty('--thumb-x', `${on.offsetLeft}px`);
        el.style.setProperty('--thumb-w', `${on.offsetWidth}px`);
      }
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(parent);
    const mo = new MutationObserver(place);
    mo.observe(parent, { attributes: true, subtree: true, childList: true, attributeFilter: ['class', 'aria-current', 'aria-pressed', 'aria-selected'] });
    return () => {
      ro?.disconnect();
      mo.disconnect();
    };
  });
  return ref;
}

/** The sidebar's active pill (row 2). */
export function SlidingPill() {
  const ref = useThumb('y');
  return <span ref={ref} className="nav-pill" aria-hidden="true" />;
}

/** A segmented control's selected thumb (row 9). */
export function SegThumb() {
  const ref = useThumb('x');
  return <span ref={ref} className="seg-thumb" aria-hidden="true" />;
}
