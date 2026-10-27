import type { Metadata } from "next";
import Link from "next/link";
import { Vibe } from "@/components/paper/Vibe";
import { compensationTotalLabel } from "@/data/compensation";
import { milestones } from "@/data/milestones";

export const metadata: Metadata = {
  title: "About",
  description: "What Unvibe is, why it exists, how it is built, and how to reach us.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const releases = milestones.filter((m) => m.category === "PRODUCT" && m.figure?.startsWith("v")).length;
  return (
    <article className="founder-about">
      <header className="founder-about__hero paper-wrap">
        <div className="founder-about__avatar" aria-hidden="true">
          <Vibe size={84} />
        </div>
        <div>
          <p className="founder-about__eyebrow">About</p>
          <h1>We build Unvibe <em>so you understand the code AI writes.</em></h1>
          <p className="founder-about__lead">
            AI writes code faster than anyone can read it. Unvibe sits beside your editor, explains the exact code you select at your level, checks that you got it, and keeps the lesson. It is free for Mac and Windows.
          </p>
          <div className="founder-about__actions">
            <a className="founder-about__btn founder-about__btn--lime" href="mailto:support@unvibe.site">Email us</a>
            <Link className="founder-about__btn" href="/investors">Investors</Link>
            <Link className="founder-about__btn" href="/beta">Try Unvibe free</Link>
          </div>
        </div>
      </header>

      <section className="paper-wrap founder-about__grid">
        <article className="founder-about__card">
          <h2>Why Unvibe</h2>
          <p>AI writes code faster than anyone can understand it. Students copy it, builders merge it, and nobody owns it. Unvibe is the place to stop and read what your AI wrote: the code you select, explained at your level, then one question to check it stuck.</p>
          <ul className="founder-about__facts">
            <li><b>{releases}+</b> releases shipped</li>
            <li><b>{compensationTotalLabel()}</b> in self-reported committed cash</li>
          </ul>
        </article>
        <article className="founder-about__card">
          <h2>How we build it</h2>
          <p>We ship small releases often and say what changed on the <Link href="/releases">releases page</Link>.</p>
          <p>Explanations come from cloud AI after a secret scan on your computer, and the <Link href="/privacy">privacy page</Link> says exactly what is sent.</p>
          <p>Free explanations have a monthly limit. You don&apos;t need a card or an API key.</p>
        </article>
      </section>

      <section className="paper-wrap founder-about__contact">
        <h2>Say hi.</h2>
        <p>Feedback, bugs, partnerships or investing: we read every email.</p>
        <a className="founder-about__btn founder-about__btn--lime" href="mailto:support@unvibe.site">Email us</a>
      </section>
    </article>
  );
}
