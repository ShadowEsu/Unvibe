import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterSignup } from "@/components/paper/NewsletterSignup";
import { Vibe } from "@/components/paper/Vibe";
import { WhoItsForCards } from "@/components/paper/WhoItsFor";
import { changelogEntries } from "@/data/milestones";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/about",
  title: "About Unvibe: Understand the Code AI Writes",
  absolute: true,
  description: "Who Unvibe is for, why it exists, what we believe, how explanations are made, and how to reach the team.",
});

export default function AboutPage() {
  // Version releases on the change log (/releases renders the same entries).
  const releases = changelogEntries().filter((m) => m.category === "PRODUCT" && m.figure?.startsWith("v")).length;
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
            AI writes code faster than anyone can read it. Unvibe sits beside your editor, explains the exact code you select at your level, checks that you got it, and keeps the lesson. Free for Mac and Windows.
          </p>
          <div className="founder-about__actions">
            <Link className="founder-about__btn founder-about__btn--lime" href="/beta">Try Unvibe free</Link>
            <Link className="founder-about__btn" href="/investors">Investors</Link>
            <a className="founder-about__btn" href="mailto:support@unvibe.site">Email us</a>
          </div>
        </div>
      </header>

      <section className="paper-wrap" aria-labelledby="about-who">
        <h2 className="founder-about__h2" id="about-who">Who it&apos;s for</h2>
        <WhoItsForCards />
      </section>

      <section className="paper-wrap founder-about__grid">
        <article className="founder-about__card">
          <h2>Why we started</h2>
          <p>AI made writing code cheap and understanding it rare. Students copy code they can&apos;t explain, builders merge changes nobody read, and the first time anyone looks closely is when it breaks. We think the fix isn&apos;t to stop using AI. It&apos;s to make reading what it wrote take one shortcut instead of an afternoon.</p>
        </article>
        <article className="founder-about__card">
          <h2>What we believe</h2>
          <ul>
            <li><b>Explain the code you&apos;re actually looking at,</b> not a tutorial about something else.</li>
            <li><b>At your level.</b> Five depths, from New to Expert. The first four are free.</li>
            <li><b>Check it stuck.</b> One Test me question, and a wrong answer comes back for review.</li>
            <li><b>Say exactly what is sent.</b> Only what you ask about: the code you selected, its file name and language, and any question you type (on Pro, also nearby code, or git changes you ask it to explain). Keys and tokens are filtered on your computer first. Your repo is never uploaded.</li>
          </ul>
        </article>
        <article className="founder-about__card">
          <h2>How we build it</h2>
          <ul>
            <li>We ship small releases often and list every one on the <Link href="/releases">change log</Link>. {releases}+ releases so far.</li>
            <li>Every explanation is generated live by cloud AI after a secret scan on your computer. The <Link href="/privacy">privacy page</Link> says exactly what is sent.</li>
            <li>Free explanations have a monthly limit. No card, no API key.</li>
          </ul>
        </article>
        <article className="founder-about__card">
          <h2>Get the newsletter</h2>
          <p>One email when something ships. No spam.</p>
          <NewsletterSignup id="about" />
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
