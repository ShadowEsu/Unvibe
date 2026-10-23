/**
 * One IntersectionObserver shared by every looping animation root (the Vibe mascot, the liquid
 * blobs, the partner marquee, small status dots). It sets data-in="true" | "false" on each root;
 * CSS pauses the root's infinite animations while data-in is "false", so nothing loops off-screen.
 * Roots start without the attribute, so they animate until the first callback.
 */
let observer: IntersectionObserver | null = null;
const onFirstEnter = new WeakMap<Element, () => void>();

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      (entry.target as HTMLElement).dataset.in = String(entry.isIntersecting);
      const enter = entry.isIntersecting ? onFirstEnter.get(entry.target) : undefined;
      if (enter) {
        onFirstEnter.delete(entry.target);
        enter();
      }
    }
  });
  return observer;
}

/** Start tracking `element`, calling `onEnter` once the first time it is on screen; returns the cleanup. */
export function observeMotion(element: HTMLElement, onEnter?: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const io = shared();
  if (onEnter) onFirstEnter.set(element, onEnter);
  io.observe(element);
  return () => {
    io.unobserve(element);
    onFirstEnter.delete(element);
    delete element.dataset.in;
  };
}
