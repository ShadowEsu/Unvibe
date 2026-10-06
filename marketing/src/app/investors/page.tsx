import type { Metadata } from "next";
import { ArrowRight, FileText, Mail } from "lucide-react";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { InvestorBriefDemo } from "@/components/paper/InvestorBriefDemo";
import { Vibe } from "@/components/paper/Vibe";
import {
  compensationCashUsd,
  compensationCreditsUsd,
  compensationLines,
  compensationTotalLabel,
  formatUsd,
} from "@/data/compensation";
import { milestones } from "@/data/milestones";
import { BETA_INSTALL_VERSION } from "@/lib/betaOffer";

export const metadata: Metadata = {
  title: "Investors",
  description: "Unvibe on one page: the thesis, what shipped, every line of startup support, what is next, and how to reach the founder.",
};

const DECK_URL = "/investors/unvibe-pitch-deck.pdf";

const pipeline = [
  ["YC", "Application in progress"],
  ["Live product directories", "LaunchKiwi, DevRove, Product Hunt, AI Tool Discovery"],
  ["Pending distribution", "Tool Index, DotProTools, DevStack, ListAi, Uneed, Launching Next"],
];

const roadmap: Array<[string, string, "shipped" | "next" | "later"]> = [
  ["After-Agent Review", "When Cursor or Claude Code edits many files, rank the real diff and give a review checklist.", "shipped"],
  ["Knowledge freshness", "Saved explanations are flagged when the code under them changes.", "shipped"],
  ["Instant Selection Bubble", "Highlight code anywhere and Unvibe offers Explain, Why, Trace, What breaks.", "next"],
  ["Ask the codebase", "Questions answered from the current repo: where is this used, what calls this.", "next"],
  ["Impact trace", "Select a function and see callers, dependencies and what might break.", "next"],
  ["GitHub app and PR intelligence", "Read-only repo connection. Every meaningful PR gets what changed, why it matters, what to review.", "later"],
  ["Shared team knowledge", "Save an explanation privately or to the team, with human confirmed and corrected states.", "later"],
];

export default function InvestorsPage() {
  const credits = formatUsd(compensationCreditsUsd());
  const cash = formatUsd(compensationCashUsd());
  const total = compensationTotalLabel();
  const sorted = [...compensationLines].sort((a, b) => b.amountUsd - a.amountUsd);
  const lead = sorted[0];
  const releases = milestones.filter((m) => m.category === "PRODUCT" && m.figure?.startsWith("v")).length;
  const company = milestones.filter((m) => m.category === "COMPANY" || m.category === "DISTRIBUTION").slice(0, 8);
  const programs = compensationLines.length;

  return (
    <article className="inv">
      <header className="inv-hero">
        <div className="inv-hero__copy">
          <p className="inv-eyebrow">Unvibe for investors</p>
          <h1>The ownership layer for <em>AI-written code.</em></h1>
          <p className="inv-lead">
            AI writes code faster than people can understand it. Unvibe sits beside the editor, explains what
            changed, checks that it stuck, and keeps the knowledge fresh as the code moves.
          </p>
          <div className="inv-actions">
            <a className="inv-btn inv-btn--ink" href={DECK_URL} target="_blank" rel="noopener noreferrer">
              <FileText size={17} /> Open the pitch deck
            </a>
            <a className="inv-btn" href="mailto:preston@unvibe.site?subject=Unvibe%20investment%20conversation">
              <Mail size={17} /> Talk to the founder
            </a>
          </div>
        </div>
        <div className="inv-hero__vibe" aria-hidden="true">
          <Vibe size={150} />
          <span className="inv-bubble">we&apos;re live, and free to try</span>
        </div>
      </header>

      <section className="inv-stats" aria-label="Unvibe at a glance">
        <div className="inv-stat inv-stat--lime"><b>{total}</b><span>startup support secured</span></div>
        <div className="inv-stat inv-stat--sky"><b>{programs}</b><span>startup programs backing us</span></div>
        <div className="inv-stat inv-stat--sun"><b>{releases}+</b><span>releases shipped, latest {BETA_INSTALL_VERSION}</span></div>
        <div className="inv-stat inv-stat--lilac"><b>Mac + Windows</b><span>public beta, free</span></div>
      </section>

      <section className="inv-section inv-thesis">
        <p className="inv-eyebrow">The thesis</p>
        <h2>Shipping is solved. <em>Understanding is not.</em></h2>
        <div className="inv-cards">
          <article className="inv-card"><span>01</span><h3>Problem</h3><p>Developers ship AI-generated code faster than they can confidently explain or maintain it. Knowledge rots the moment the code changes.</p></article>
          <article className="inv-card"><span>02</span><h3>Product</h3><p>Select code, press ⌘U. Unvibe explains it in place at five depths, quizzes you, saves the lesson, and reviews what your agent just changed.</p></article>
          <article className="inv-card"><span>03</span><h3>Wedge</h3><p>A desktop layer that works beside Cursor, VS Code, Claude Code and Terminal instead of replacing the editor. Neutral across every agent.</p></article>
        </div>
      </section>

      <section className="inv-section">
        <p className="inv-eyebrow">See it</p>
        <h2>The product, <em>in one pass.</em></h2>
        <InvestorBriefDemo />
      </section>

      <section className="inv-section" id="support">
        <p className="inv-eyebrow">Resource runway</p>
        <h2>Where the {total} <em>comes from.</em></h2>
        <p className="inv-lead">Every program credit and founder-reported cash line, by source. Program credits {credits} · cash {cash}. Credits are not cash, and this is not a funding round.</p>
        <div className="inv-table" role="table" aria-label="Support by source">
          <div className="inv-row inv-row--head" role="row">
            <span role="columnheader">Source</span><span role="columnheader">Amount</span><span role="columnheader">What it is</span><span role="columnheader">Status</span>
          </div>
          {sorted.map((line) => (
            <div key={line.name} className={`inv-row${line === lead ? " inv-row--lead" : ""}`} role="row">
              <strong role="cell">{line.name}</strong>
              <span role="cell" className="inv-amount">{formatUsd(line.amountUsd)}</span>
              <span role="cell">{line.detail}</span>
              <span role="cell"><i className="inv-pill">{line.state}</i></span>
            </div>
          ))}
        </div>
      </section>

      <section className="inv-section">
        <p className="inv-eyebrow">Commitments</p>
        <h2>What shipped, <em>and what&apos;s next.</em></h2>
        <ol className="inv-roadmap">
          {roadmap.map(([name, detail, state]) => (
            <li key={name} data-state={state}>
              <i className="inv-pill">{state === "shipped" ? "Shipped" : state === "next" ? "Building next" : "After that"}</i>
              <strong>{name}</strong>
              <p>{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="inv-section inv-split">
        <div>
          <p className="inv-eyebrow">Milestones</p>
          <h2>The company <em>so far.</em></h2>
          <ul className="inv-timeline">
            {company.map((m) => (
              <li key={`${m.date}-${m.title}`}><time>{m.date}</time><strong>{m.title}</strong>{m.figure ? <span>{m.figure}</span> : null}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="inv-eyebrow">Pipeline</p>
          <h2>Applications, <em>kept separate.</em></h2>
          <div className="inv-pipeline">
            {pipeline.map(([name, detail]) => (
              <article key={name} className="inv-card"><h3>{name}</h3><p>{detail}</p></article>
            ))}
          </div>
          <a className="inv-link" href="/build">Follow the live build <ArrowRight size={14} /></a>
        </div>
      </section>

      <section className="inv-section inv-close">
        <h2>Let&apos;s <em>talk.</em></h2>
        <p className="inv-lead">Deck, demo, numbers. Everything above is current as of {BETA_INSTALL_VERSION}.</p>
        <div className="inv-actions inv-actions--center">
          <a className="inv-btn inv-btn--ink" href="mailto:preston@unvibe.site?subject=Unvibe%20investment%20conversation"><Mail size={17} /> preston@unvibe.site</a>
          <a className="inv-btn" href={DECK_URL} target="_blank" rel="noopener noreferrer"><FileText size={17} /> Pitch deck</a>
        </div>
      </section>

      <section className="inv-section">
        <BetaInstall tone="page" />
      </section>
    </article>
  );
}
