import type { Metadata } from "next";
import { ArrowRight, FileText, Mail } from "lucide-react";
import { BetaInstall } from "@/components/paper/BetaInstall";
import {
  compensationCashUsd,
  compensationCreditsUsd,
  compensationLines,
  compensationTotalLabel,
  formatUsd,
} from "@/data/compensation";

export const metadata: Metadata = {
  title: "Investors",
  description: "Unvibe product thesis, traction, startup support, and founder contact.",
};

const DECK_URL = "/investors/unvibe-pitch-deck.pdf";

const pipeline = [
  ["YC", "Application work in progress"],
  ["Live product directories", "LaunchKiwi, DevRove, Product Hunt, AI Tool Discovery"],
  ["Pending distribution", "Tool Index, DotProTools, DevStack, ListAi, Uneed, Launching Next"],
];

export default function InvestorsPage() {
  const credits = formatUsd(compensationCreditsUsd());
  const cash = formatUsd(compensationCashUsd());
  const total = compensationTotalLabel();
  const mixpanel = compensationLines.find((line) => line.name.startsWith("Mixpanel"));
  const mixpanelAmount = mixpanel ? formatUsd(mixpanel.amountUsd) : "$144,000";
  const otherLines = compensationLines.filter((line) => !line.name.startsWith("Mixpanel"));

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
        <aside className="investor-hero__stage">
          <p>Current stage</p>
          <strong>Private beta</strong>
          <span>75% to public release</span>
          <a href="/build">Follow the live build <ArrowRight size={13} /></a>
        </aside>
      </header>

      <section className="container-page investor-money" aria-label="Total support">
        <p className="launch-label">Total support raised</p>
        <p className="investor-money__total">{total}</p>
        <p className="investor-money__mixpanel">
          <span>Largest line</span>
          <strong>Mixpanel for Startups · {mixpanelAmount}</strong>
          <small>1 year Mixpanel Pro subscription credits</small>
        </p>
        <p className="investor-money__split">
          Program credits {credits} · Cash {cash}. Credits are not cash. Not a funding round.
        </p>
        <a className="investor-money__link" href="#support">
          Full breakdown by source <ArrowRight size={14} />
        </a>
      </section>

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

      <section className="container-page investor-support" id="support">
        <div className="investor-section-copy">
          <p className="launch-label">Resource runway</p>
          <h2>Where the {total} comes from.</h2>
          <p>
            Every program credit and founder-reported cash line, listed by source.
            Credits are not cash and this is not a funding-round total.
          </p>
          <dl className="investor-support__totals">
            <div>
              <dt>All support</dt>
              <dd>{total}</dd>
            </div>
            <div>
              <dt>Mixpanel for Startups</dt>
              <dd>{mixpanelAmount}</dd>
            </div>
            <div>
              <dt>Program credits</dt>
              <dd>{credits}</dd>
            </div>
            <div>
              <dt>Cash committed</dt>
              <dd>{cash}</dd>
            </div>
          </dl>
        </div>
        <div className="investor-support__table" role="table" aria-label="Support by source">
          <div className="investor-support__row investor-support__row--head" role="row">
            <span role="columnheader">Source</span>
            <span role="columnheader">Amount</span>
            <span role="columnheader">What it is</span>
            <span role="columnheader">Status</span>
          </div>
          {mixpanel ? (
            <div className="investor-support__row investor-support__row--lead" role="row">
              <strong role="cell">{mixpanel.name}</strong>
              <span role="cell">{formatUsd(mixpanel.amountUsd)}</span>
              <span role="cell">{mixpanel.detail}</span>
              <span role="cell">{mixpanel.state}</span>
            </div>
          ) : null}
          {otherLines.map((line) => (
            <div key={line.name} className="investor-support__row" role="row">
              <strong role="cell">{line.name}</strong>
              <span role="cell">{formatUsd(line.amountUsd)}</span>
              <span role="cell">{line.detail}</span>
              <span role="cell">{line.state}</span>
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
