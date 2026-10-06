import type { Metadata } from "next";
import { FirstOpenSteps } from "@/components/paper/FirstOpenSteps";
import { Vibe } from "@/components/paper/Vibe";

export const metadata: Metadata = {
  title: "Install help",
  description: "How to open Unvibe the first time on Mac and Windows, and how to fix a download that will not open.",
};

export default function InstallHelpPage() {
  return (
    <main className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Install help</p>
          <h1>Opening Unvibe <em>the first time.</em></h1>
          <p className="fos-page__lead">Unvibe is free and brand new, so Apple and Microsoft have not verified it yet. That means one extra click the first time. Here is exactly what to press.</p>
        </div>
      </header>
      <FirstOpenSteps />
      <p className="fos-page__help">Still stuck? Email <a href="mailto:preston@unvibe.site?subject=Unvibe%20install%20help">preston@unvibe.site</a> with a screenshot and your Mac or Windows version. A real person answers.</p>
    </main>
  );
}
