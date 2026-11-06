"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";

/**
 * The home page's persistent download pill (Design N, the Dia pattern): on once the hero's own download has
 * scrolled out of view, off again while another download on the page is on screen (the Free plan's button,
 * the closing download section), so there is only ever one download button in view (Design, phone). It
 * replaces the small-screen bar on this page (MobileDownloadBar skips "/"). A phone gets "Email me the link"
 * (DownloadLink sends it to the hero form).
 */
export function HomeDock() {
  const [device, setDevice] = useState<VisitorDevice>("mac");
  const [on, setOn] = useState(false);
  const state = useRef({ heroOut: false, others: new Set<Element>() });

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
    const hero = document.getElementById("hill-cta");
    const others = [document.querySelector(".nprice__get"), document.getElementById("install")].filter((node): node is Element => node !== null);
    if (!hero || typeof IntersectionObserver === "undefined") return undefined;
    const sync = () => setOn(state.current.heroOut && state.current.others.size === 0);
    const heroIo = new IntersectionObserver(([entry]) => {
      state.current.heroOut = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      sync();
    });
    // The dock covers the bottom ~90 px; a button under it counts as on screen.
    const othersIo = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) state.current.others.add(entry.target);
        else state.current.others.delete(entry.target);
      }
      sync();
    });
    heroIo.observe(hero);
    for (const node of others) othersIo.observe(node);
    return () => {
      heroIo.disconnect();
      othersIo.disconnect();
    };
  }, []);

  const platform = device === "windows" ? "windows" : "mac";
  // To the page's install box, not the file: the downloaded .dmg isn't notarized yet, so the Terminal line goes first.
  return (
    <aside className={on ? "ndock is-on" : "ndock"} aria-label="Get Unvibe" aria-hidden={!on} {...((on ? {} : { inert: "" }) as Record<string, string>)}>
      <DownloadLink href="#install" platform={platform} surface="mobile_bar" />
    </aside>
  );
}
