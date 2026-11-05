"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";

/**
 * The home page's persistent download pill (Design N, the Dia pattern): on once the hero's own download has
 * scrolled out of view, off again while the closing download section is in view, so there is never a second
 * identical button on screen. It replaces the small-screen bar on this page (MobileDownloadBar skips "/").
 * A phone gets "Email me the link" (DownloadLink sends it to the hero form).
 */
export function HomeDock() {
  const [device, setDevice] = useState<VisitorDevice>("mac");
  const [on, setOn] = useState(false);
  const state = useRef({ heroOut: false, endIn: false });

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
    const hero = document.getElementById("hill-cta");
    const end = document.getElementById("install");
    if (!hero || !end || typeof IntersectionObserver === "undefined") return undefined;
    const sync = () => setOn(state.current.heroOut && !state.current.endIn);
    const heroIo = new IntersectionObserver(([entry]) => {
      state.current.heroOut = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      sync();
    });
    const endIo = new IntersectionObserver(([entry]) => {
      state.current.endIn = entry.isIntersecting;
      sync();
    }, { rootMargin: "0px 0px -10% 0px" });
    heroIo.observe(hero);
    endIo.observe(end);
    return () => {
      heroIo.disconnect();
      endIo.disconnect();
    };
  }, []);

  const platform = device === "windows" ? "windows" : "mac";
  return (
    <aside className={on ? "ndock is-on" : "ndock"} aria-label="Get Unvibe" aria-hidden={!on} {...((on ? {} : { inert: "" }) as Record<string, string>)}>
      <DownloadLink href={platform === "windows" ? BETA_WINDOWS_DIRECT_DOWNLOAD : BETA_MAC_DIRECT_DOWNLOAD} platform={platform} surface="mobile_bar" />
    </aside>
  );
}
