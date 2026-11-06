"use client";

import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from "@/lib/aiMaintenance";
import { FirstOpenBand, GetUnvibe, SitePage, useDevice } from "@/site/parts";

/** /beta (Design package-1106, round 10): Get Unvibe with the live InstallBox on the visitor's computer, then the
 * first-open steps on their own band, the shortcut and the update note. */
export function Download() {
  const device = useDevice();
  return (
    <SitePage>
      <section className="ad" aria-labelledby="install-title">
        <GetUnvibe device={device} page />
        {AI_MAINTENANCE ? <p className="ad__status" role="status">{AI_MAINTENANCE_NOTE}</p> : null}
      </section>
      <section className="ad-first a-band"><FirstOpenBand device={device} /></section>
    </SitePage>
  );
}
