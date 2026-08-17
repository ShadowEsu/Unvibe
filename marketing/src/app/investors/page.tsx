import type { Metadata } from "next";
import { ArrowRight, FileText, Mail } from "lucide-react";
import { BetaInstall } from "@/components/paper/BetaInstall";

export const metadata: Metadata = {
  title: "Investors",
  description: "Unvibe product thesis, traction, startup support, and founder contact.",
};

const DECK_URL = "/investors/unvibe-pitch-deck.pdf";

const support = [
  { name: "GitLab for Startups", value: "$23,700 GitLab Ultimate credits", state: "Secured" },
  { name: "Google AI Startups", value: "$2,000 Google Cloud credits, USD", state: "Secured" },
  { name: "MongoDB for Startups", value: "$500 program support", state: "Secured" },
  { name: "Founder capital", value: "$500 committed", state: "Committed" },
  { name: "Early angel support", value: "$300 committed", state: "Founder-reported" },
];

const pipeline = [
  ["YC", "Application work in progress"],
  ["AWS Activate", "Exploring eligibility · up to $200k is a program ceiling, not secured capital"],
  ["Live product directories", "LaunchKiwi, DevRove, Product Hunt, AI Tool Discovery"],
  ["Pending distribution", "Tool Index, DotProTools, DevStack, ListAi, Uneed, Launching Next"],
];

export default function InvestorsPage() {
  return (
    <article className="investor-page">
      <header className="container-page investor-hero">
        <div>
          <p className="launch-label">Unvibe / investors</p>
          <h1>The ownership layer<br />for AI-written code.</h1>
          <p>
            AI coding compresses implementation time. Unvibe restores the review,
            understanding, and memory developers need to maintain what gets shipped.
          </p>
          <div className="investor-actions">
            <a href={DECK_URL} target="_blank" rel="noopener noreferrer">
              <FileText size={16} /> Open pitch deck
            </a>
            <a href="mailto:preston@unvibe.site?subject=Unvibe%20investment%20conversation">
              <Mail size={16} /> Contact founder
            </a>
          </div>
        </div>
        <aside>
          <p>Current stage</p>
          <strong>Private beta</strong>
          <span>75% to public release</span>
          <a href="/build">Follow the live build <ArrowRight size={13} /></a>
        </aside>
      </header>

      <section className="container-page investor-thesis">
        <article>
          <span>01</span>
          <h2>Problem</h2>
          <p>Developers can ship AI-generated code faster than they can confidently explain or maintain it.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Product</h2>
          <p>Select code, press ⌘U, review the change, test understanding, and keep the knowledge.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Wedge</h2>
          <p>A Mac desktop layer that works beside Cursor and VS Code instead of replacing the editor.</p>
        </article>
      </section>

      <section className="container-page investor-support">
        <div className="investor-section-copy">
          <p className="launch-label">Resource runway</p>
          <h2>Startup credits, not a round.</h2>
          <p>
            Cloud and platform credits plus founder-reported committed capital. Credits are not cash and this is not a funding-round total.
          </p>
        </div>
        <div className="investor-support__list">
          {support.map((item) => (
            <div key={item.name}>
              <span>{item.state}</span>
              <strong>{item.name}</strong>
              <p>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page investor-pipeline">
        <div>
          <p className="launch-label">Company pipeline</p>
          <h2>Applications stay separate from achievements.</h2>
        </div>
        <div>
          {pipeline.map(([name, detail]) => (
            <article key={name}>
              <strong>{name}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page investor-download">
        <BetaInstall tone="page" />
      </section>
    </article>
  );
}
