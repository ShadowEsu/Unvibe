"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { JoinWaitlistRow } from "@/components/paper/JoinWaitlistLink";

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
    <section className="paper-hero" aria-label="Unvibe private beta">
      <Image src="/hero/golden-gate.png" alt="" fill priority sizes="100vw" />
      <div className="paper-hero__veil" />
      <div className={ready ? "paper-hero__copy is-ready" : "paper-hero__copy"}>
        <p className="paper-meta paper-hero__eyebrow">For developers and engineering teams</p>
        <h1 className="paper-hero__headline--business">Keep your engineering team ahead of its codebase.</h1>
        <p className="paper-hero__kicker">Select code → AI explains it → save concepts → learn.</p>
        <JoinWaitlistRow href="#install" intent="install" />
        <Link href="/teams" className="paper-hero__teams-link">Explore Unvibe Teams →</Link>
      </div>
    </section>
  );
}
