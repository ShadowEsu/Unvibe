import type { Metadata } from "next";
import Link from "next/link";
import { Vibe } from "@/components/paper/Vibe";
import { compensationTotalLabel } from "@/data/compensation";
import { milestones } from "@/data/milestones";

export const metadata: Metadata = {
  title: "Founder",
  description:
    "Unvibe is built by Preston Susanto, a student founder studying EECS at Diablo Valley College in California. Who he is, why he built Unvibe, and how to reach him.",
  alternates: { canonical: "/about" },
};

const TRACK = [
  { title: "SF Hacks 2026", detail: "Built Sortify, a gamified AI waste sorting app with ML hardware, in 48 hours. Won Best Beginner Hack, Best Hardware Hack and Best Use of Boxi AI out of 250+ people." },
  { title: "Mega Hackathon 2026", detail: "Won the Gaming Award solo, against 950+ participants." },
  { title: "CauliflowerAI Hackathon", detail: "Built Cauliform, a voice agent that calls you and fills Google Forms for you, with Gemini, Twilio and Google Cloud." },
  { title: "Aiko Matcha", detail: "Founded and launched the store as lead web developer. Over $1,000 in revenue in the first week." },
  { title: "Wosado Australia", detail: "Lead software developer and architect for an Australian beauty brand's e-commerce." },
  { title: "Research", detail: "Writing \"Reward Shaping for Accessible AI Tutoring in Community Colleges\", on making adaptive AI tutoring run on consumer hardware. Supervised by Professor Kyu Woong Lee at DVC." },
];

const ROLES = [
  "Code The Change: project lead and software engineer officer, mentoring 20+ members",
  "Google Developer Group: software engineer officer",
  "Alpha Gamma Sigma honor society: webmaster for 109+ honors students",
  "Toastmasters: engagement coordinator",
  "PERMIAS Nasional: creative lead for a national Indonesian student nonprofit",
  "Wesley Hack Club, Perth: co-founder of the school's first CS club",
];

const AWARDS = [
  "Phillip Howe Scholarship, Diablo Valley College",
  "Computer Science Prize, top of 110 students, Wesley College",
  "Academic Excellence Award, top 1% of the cohort",
  "Three hackathon awards at SF Hacks 2026",
  "Gaming Award, Mega Hackathon 2026",
  "Bronze Duke of Edinburgh Award",
];

export default function AboutPage() {
  const releases = milestones.filter((m) => m.category === "PRODUCT" && m.figure?.startsWith("v")).length;
  return (
    <article className="founder-about">
      <header className="founder-about__hero paper-wrap">
        <div className="founder-about__avatar" aria-hidden="true">
          <span>PS</span>
          <i><Vibe size={54} /></i>
        </div>
        <div>
          <p className="founder-about__eyebrow">Founder</p>
          <h1>Preston Susanto, <em>building Unvibe.</em></h1>
          <p className="founder-about__lead">
            I&apos;m 17, a student founder studying Electrical Engineering and Computer Science at Diablo Valley College in Pleasant Hill, California. I build Unvibe because I kept shipping code AI wrote for me that I couldn&apos;t explain. Unvibe fixes that: select the code, press one key, and actually understand it.
          </p>
          <div className="founder-about__actions">
            <a className="founder-about__btn founder-about__btn--lime" href="mailto:preston@unvibe.site">Email me</a>
            <Link className="founder-about__btn" href="/investors">Investors</Link>
            <Link className="founder-about__btn" href="/beta">Try Unvibe free</Link>
          </div>
        </div>
      </header>

      <section className="paper-wrap founder-about__grid">
        <article className="founder-about__card">
          <h2>My story</h2>
          <p>I grew up in Jakarta, moved to Perth in 2021, and to California in 2025. I speak English, Indonesian and Mandarin.</p>
          <p>I taught myself from Berkeley&apos;s CS285 and Stanford&apos;s CS234 lectures, on a MacBook with no GPU and no cloud budget. That constraint shapes how I build: things that work for people without the resources most tools assume.</p>
          <p>I&apos;m aiming to transfer to UC Berkeley, and I hold a 4.0 GPA while building Unvibe.</p>
        </article>
        <article className="founder-about__card">
          <h2>Why Unvibe</h2>
          <p>AI writes code faster than anyone can understand it. Students copy it, builders merge it, and nobody owns it. I wanted a tool that sits beside the editor, explains the exact code in front of you at your level, checks you got it, and keeps the lesson.</p>
          <ul className="founder-about__facts">
            <li><b>{releases}+</b> releases shipped</li>
            <li><b>{compensationTotalLabel()}</b> in startup support</li>
            <li><b>Claude for Startups</b> member</li>
          </ul>
        </article>
      </section>

      <section className="paper-wrap">
        <h2 className="founder-about__h2">Things I&apos;ve built</h2>
        <div className="founder-about__track">
          {TRACK.map((t) => (
            <article key={t.title} className="founder-about__item">
              <h3>{t.title}</h3>
              <p>{t.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="paper-wrap founder-about__grid">
        <article className="founder-about__card">
          <h2>Communities I lead</h2>
          <ul>{ROLES.map((r) => <li key={r}>{r}</li>)}</ul>
        </article>
        <article className="founder-about__card">
          <h2>Awards</h2>
          <ul>{AWARDS.map((a) => <li key={a}>{a}</li>)}</ul>
        </article>
      </section>

      <section className="paper-wrap founder-about__contact">
        <h2>Say hi.</h2>
        <p>Feedback, bugs, partnerships or investing: I read every email myself.</p>
        <a className="founder-about__btn founder-about__btn--lime" href="mailto:preston@unvibe.site">preston@unvibe.site</a>
      </section>
    </article>
  );
}
