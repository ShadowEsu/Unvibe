import { useLayoutEffect, useRef } from 'react';

/**
 * The sliding thumbs of Design's motion layer (r2-motion SPEC §3 rows 2 and 9): one absolutely positioned element
 * inside a nav or segmented control that moves to the selected item with a transform (app-0151.css `.nav-pill`,
 * `.seg-thumb`). It measures the descendant marked `.on`, `.is-on`, `[aria-current]`, `[aria-pressed="true"]`, `[aria-checked="true"]` or
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
      const on = parent.querySelector<HTMLElement>('.on, .is-on, [aria-current], [aria-pressed="true"], [aria-selected="true"], [aria-checked="true"]');
      if (!on) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      // Offsets relative to the thumb's parent (`position: relative`), whatever sits between: the sidebar's one pill
      // spans two navs and the heading between them.
      const box = parent.getBoundingClientRect();
      const target = on.getBoundingClientRect();
      if (axis === 'y') {
        el.style.setProperty('--pill-y', `${target.top - box.top + parent.scrollTop}px`);
        el.style.setProperty('--pill-h', `${target.height}px`);
      } else {
        el.style.setProperty('--thumb-x', `${target.left - box.left + parent.scrollLeft}px`);
        el.style.setProperty('--thumb-w', `${target.width}px`);
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
