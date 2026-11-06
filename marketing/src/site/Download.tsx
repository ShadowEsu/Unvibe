"use client";

import { FirstOpenBand, GetUnvibe, HelpBlock, SitePage, useVisitor } from "@/site/parts";

/** /beta (Design package-1106, round 10): Get Unvibe with the live InstallBox on the visitor's computer, then the
 * first-open steps on their own band, the shortcut and the update note, then the live page's quick fixes (#help:
 * the desktop app's Help item and /activate link there). */
export function Download() {
  const visitor = useVisitor();
  return (
    <SitePage>
      <section className="ad" id="install" aria-labelledby="install-title"><GetUnvibe visitor={visitor} page /></section>
      <section className="ad-first a-band"><FirstOpenBand /></section>
      <section className="lx-sec" id="help" aria-labelledby="help-title"><HelpBlock /></section>
    </SitePage>
  );
}
