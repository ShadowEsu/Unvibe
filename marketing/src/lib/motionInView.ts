/**
 * One IntersectionObserver shared by every looping animation root (the Vibe mascot, the liquid
 * blobs, the partner marquee). It sets data-in="true" | "false" on each root; CSS pauses the
 * root's infinite animations while data-in is "false", so nothing loops off-screen.
 * Roots start without the attribute, so they animate until the first callback.
 */
let observer: IntersectionObserver | null = null;

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) (entry.target as HTMLElement).dataset.in = String(entry.isIntersecting);
  });
  return observer;
}

/** Start tracking `element`; returns the cleanup that stops it. */
export function observeMotion(element: HTMLElement): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const io = shared();
  io.observe(element);
  return () => {
    io.unobserve(element);
    delete element.dataset.in;
  };
}
