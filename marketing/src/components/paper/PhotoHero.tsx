"use client";

import { useEffect, useState } from "react";
import { DownloadRow } from "@/components/paper/DownloadLink";
import { Vibe } from "@/components/paper/Vibe";
import { track } from "@/lib/analytics";
import { SHORTCUTS, detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";

const LEAD = "Understand the code";
const ACCENT = "AI ships for you.";

/**
 * Phones can't run the desktop app. Instead of dead download buttons, let the visitor
 * send the link to their computer (share sheet or copy) or try Vibe right here.
 */
function SendToDesktop() {
  const [copied, setCopied] = useState(false);
  const send = async () => {
    const url = "https://unvibe.site/?ref=phone";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Unvibe", text: "Install Unvibe on my Mac or PC", url });
        track("phone_link_sent", { method: "share" });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("phone_link_sent", { method: "copy" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* share sheet closed or clipboard blocked */
    }
  };
  return (
    <div className="vhero__phone">
      <p>Unvibe runs on your Mac or PC, right beside your editor.</p>
      <div className="paper-join-row">
        <button type="button" className="paper-join paper-join--mac" onClick={() => void send()}>
          <span className="paper-join__label">{copied ? "Link copied" : "Send the link to my computer"}</span>
        </button>
        <a className="paper-join paper-join--win" href="#try-it" onClick={() => track("phone_try_clicked")}>
          <span className="paper-join__label">Try it here first</span>
        </a>
      </div>
    </div>
  );
}

/** Homepage hero: Vibe, one line of promise, the download buttons (or send-to-computer on phones). */
export function PhotoHero() {
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<VisitorDevice>("mac");

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReady(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const bubble =
    device === "phone"
      ? "psst, I live on your Mac or PC"
      : `psst, select any code and press ${device === "windows" ? SHORTCUTS.windows.anywhere : SHORTCUTS.mac.anywhere}`;

  return (
    <section className={ready ? "vhero is-ready" : "vhero"} aria-label="Unvibe">
      <div className="vhero__copy">
        <div className="vhero__vibe">
          <Vibe size={104} />
          <span className="vhero__bubble">{bubble}</span>
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
        {device === "phone" ? <SendToDesktop /> : <DownloadRow />}
        <p className="vhero__fine">Free · No API key · No card</p>
        <a className="vhero__program" href="#backing">In <b>Claude for Startups</b></a>
      </div>
      <a href="#tour" className="vhero__scroll" aria-label="See the app">
        <span />
      </a>
    </section>
  );
}
