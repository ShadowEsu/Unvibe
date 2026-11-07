import type { CSSProperties, ReactNode } from "react";
import { DiaMotion } from "./motion/DiaMotion";

/** The three photos (marketing/public/d/bg/, PROVENANCE.md): HAER CA-31, Jet Lowe 1984, public domain. */
const PHOTOS = {
  changelog: "Golden Gate Bridge, looking north from Fort Point, 1984. Historic American Engineering Record, Library of Congress · public domain",
  faq: "Golden Gate Bridge, looking south at dusk, 1984. Historic American Engineering Record, Library of Congress · public domain",
  investors: "Golden Gate Bridge, from the south tower looking north, 1984. Historic American Engineering Record, Library of Congress · public domain",
} as const;

/**
 * The "pricing image" page (Design 2055 §3; ledger 562): a fixed black-and-white photo behind the whole page under a
 * paper veil, its credit in a chip while it shows, and the page's own content on white cards (text never sits on the
 * photo). The photo is decoration (aria-hidden, low fetch priority, out of flow: no CLS); the page H1 stays the LCP.
 * Motion's page-hero entrance runs on data-d-page-bg (dia-motion.css 562 §1).
 */
export function PhotoPage({ photo, wide, labelledBy, children }: { photo: keyof typeof PHOTOS; wide?: boolean; labelledBy: string; children: ReactNode }) {
  return (
    <div className={`d d-page dg-page${wide ? " dg-page--wide" : ""}`}>
      <DiaMotion />
      <div className="dg__bg" aria-hidden="true">
        <picture>
          <source type="image/avif" media="(max-width: 820px)" srcSet={`/d/bg/${photo}-ggb-1200.avif`} />
          <source type="image/avif" srcSet={`/d/bg/${photo}-ggb-2400.avif`} />
          <source type="image/webp" media="(max-width: 820px)" srcSet={`/d/bg/${photo}-ggb-1200.webp`} />
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed full-bleed background, sized by CSS */}
          <img src={`/d/bg/${photo}-ggb-2400.webp`} alt="" fetchPriority="low" decoding="async" data-d-page-bg="" />
        </picture>
        <div className="dg__veil" />
      </div>
      <article className="dg" aria-labelledby={labelledBy}>{children}</article>
      {/* on the photo at the end of the page, right-aligned (photo.css) */}
      <p className="dg__credit" data-d-enter="">{PHOTOS[photo]}</p>
    </div>
  );
}

/** Motion's blur-up stagger (data-d-enter): the delay of one element in the page hero (120 / 200 / 280 ms). */
export function enterDelay(ms: number): CSSProperties {
  return { "--d": `${ms}ms` } as CSSProperties;
}

/** The header card: the white glass card that holds the page's H1, intro and meta. */
export function PhotoHead({ children }: { children: ReactNode }) {
  return <header className="dg__head">{children}</header>;
}
