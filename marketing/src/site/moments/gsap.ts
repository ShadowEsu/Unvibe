/**
 * GSAP for the signature moments (Design motion bar §2.3 addendum): core + SplitText only, imported dynamically after
 * the page's load event and an idle slot, so none of it is in the first-load JS and the H1 has painted long before.
 *
 * ScrollTrigger is deliberately not loaded: core + ScrollTrigger + SplitText is 49.9 KB gzip (3.15.0 min files:
 * 28,268 + 17,998 + 3,658 B), over the addendum's 45 KB cap. The one scrubbed moment pins with CSS `position: sticky`
 * (spacing reserved in CSS, CLS 0) and drives its timeline's progress from one passive scroll listener instead.
 */
import type { gsap as GsapCore } from "gsap";
import type { SplitText as SplitTextPlugin } from "gsap/SplitText";

type Gsap = typeof GsapCore;
type Split = typeof SplitTextPlugin;

let loading: Promise<{ gsap: Gsap; SplitText: Split }> | null = null;

// The executor form on purpose: Promise.withResolvers() is missing before Safari 17.4, and this runs on the home page.
function afterLoadAndIdle(): Promise<void> {
  return new Promise((resolve) => {
    const idle = () => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: 1500 });
      else window.setTimeout(resolve, 200);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
}

export function loadGsap() {
  loading ??= afterLoadAndIdle()
    .then(() => Promise.all([import("gsap"), import("gsap/SplitText")]))
    .then(([core, split]) => {
      core.gsap.registerPlugin(split.SplitText);
      return { gsap: core.gsap, SplitText: split.SplitText };
    });
  return loading;
}

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
