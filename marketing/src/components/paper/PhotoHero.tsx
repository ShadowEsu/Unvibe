"use client";

import { useEffect, useState } from "react";
import { DownloadRow } from "@/components/paper/DownloadLink";
import { Vibe } from "@/components/paper/Vibe";

const LEAD = "Understand the code";
const ACCENT = "AI ships for you.";

/** Homepage hero: Vibe, one line of promise, the download buttons. */
export function PhotoHero() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReady(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className={ready ? "vhero is-ready" : "vhero"} aria-label="Unvibe">
      <div className="vhero__copy">
        <div className="vhero__vibe">
          <Vibe size={104} />
          <span className="vhero__bubble">psst, select any code and press ⌘U</span>
        </div>
        <h1 aria-label={`${LEAD} ${ACCENT}`}>
          <span className="vhero__lead">{LEAD}</span> <em>{ACCENT}</em>
        </h1>
        <p className="vhero__kicker">
          Select code in Cursor, VS Code or Terminal. Vibe explains it right beside your editor, checks you got it, and keeps the lesson.
        </p>
        <div className="vhero__stickers" aria-hidden="true">
          <span className="vsticker vsticker--lime">Explain in place</span>
          <span className="vsticker vsticker--sky">Five depths</span>
          <span className="vsticker vsticker--sun">Test me</span>
          <span className="vsticker vsticker--lilac">Saved for later</span>
        </div>
        <DownloadRow />
        <p className="vhero__fine">Free · No API key · No card</p>
        <a className="vhero__program" href="#backing">In <b>Claude for Startups</b></a>
      </div>
      <a href="#tour" className="vhero__scroll" aria-label="See the app">
        <span />
      </a>
    </section>
  );
}
