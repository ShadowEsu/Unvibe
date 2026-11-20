import type { ReactNode } from "react";
import { DiaMotion } from "./motion/DiaMotion";

/**
 * The text pages /releases, /faq and /investors in Option A (Design spec §7): a left-aligned H1 and lead, then the
 * page's content in white boxes with 1 px edges, on the white page. No photo, no picture standing in for one. The H1
 * and lead are painted in the first frame (no reveal); the boxes under them reveal once (data-d-enter).
 */
export function PhotoPage({ wide, labelledBy, children }: { wide?: boolean; labelledBy: string; children: ReactNode }) {
  return (
    <div className={`d d-page dg-page${wide ? " dg-page--wide" : ""}`}>
      <DiaMotion />
      <article className="dg" aria-labelledby={labelledBy}>{children}</article>
    </div>
  );
}

/** The page head: the eyebrow, the H1, the lead and the page's meta. */
export function PhotoHead({ children }: { children: ReactNode }) {
  return <header className="dg__head">{children}</header>;
}
