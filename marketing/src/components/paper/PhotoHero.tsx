"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { JoinWaitlistLink } from "@/components/paper/JoinWaitlistLink";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";

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
    <section className="paper-hero" aria-label="Unvibe public beta">
      <Image src="/hero/golden-gate.png" alt="" fill priority sizes="100vw" />
      <div className="paper-hero__veil" />
      <div className={ready ? "paper-hero__copy is-ready" : "paper-hero__copy"}>
        <p className="paper-meta paper-hero__eyebrow">Public beta · desktop overlay for Cursor, VS Code, and more</p>
        <h1 className="paper-hero__headline--business">Understand the AI-generated code you ship.</h1>
        <p className="paper-hero__kicker">Select code → Unvibe explains it beside your editor → save it, quiz yourself, keep ownership.</p>
        <div className="paper-join-row">
          <JoinWaitlistLink href={BETA_MAC_DIRECT_DOWNLOAD} platform="mac" intent="install" />
          <JoinWaitlistLink href={BETA_WINDOWS_DIRECT_DOWNLOAD} platform="windows" intent="install" />
        </div>
        <Link href="/teams" className="paper-hero__teams-link">Explore Unvibe Teams →</Link>
      </div>
    </section>
  );
}
