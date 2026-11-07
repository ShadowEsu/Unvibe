import type { Metadata } from "next";
import Link from "next/link";
import { ProgramList } from "@/components/paper/BackingStrip";
import {
  compensationCashUsd,
  compensationCreditsUsd,
  compensationProgramCount,
  compensationTotalLabel,
  compensationTotalPhrase,
  formatUsd,
  programsOutsideTotalCount,
  supportRows,
} from "@/data/compensation";
import { listingLinks } from "@/data/listings";
import { milestones } from "@/data/milestones";
import { BETA_INSTALL_VERSION } from "@/lib/betaOffer";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/pageMeta";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { PRICING } from "@/lib/pricing";
import { BtnDot } from "@/site/dia/effects";
import { PhotoHead, PhotoPage, enterDelay } from "@/site/dia/PhotoPage";

export const metadata: Metadata = pageMetadata({
  path: "/investors",
  title: "Investors",
  description: "Unvibe on one page: the thesis, what shipped, every startup-program credit and committed cash line, what is next, and how to reach us.",
});

/** Re-read the payments status at most every 5 minutes, as /pricing does. */
export const revalidate = 300;

const MAIL = `mailto:${SUPPORT_EMAIL}?subject=Unvibe%20investment%20conversation`;

const roadmap: Array<[string, string, "shipped" | "next" | "later"]> = [
  ["After-Agent Review", "When Cursor or Claude Code edits many files, rank the real diff and give a review checklist.", "shipped"],
  ["Knowledge freshness", "Saved explanations remember the code they explained. Refresh one in Briefs to see if it changed.", "shipped"],
  ["Instant Selection Bubble", "Highlight code anywhere and Unvibe offers Explain, Why, Trace, What breaks.", "next"],
  ["Ask the codebase", "Questions answered from the current repo: where is this used, what calls this.", "next"],
  ["Impact trace", "Select a function and see callers, dependencies and what might break.", "next"],
  ["GitHub app and PR intelligence", "Read-only repo connection. Every meaningful PR gets what changed, why it matters, what to review.", "later"],
  ["Shared team knowledge", "Save an explanation privately or to the team, with human confirmed and corrected states.", "later"],
];

/** Guides that exist on the site (the brief's "guides/info"). */
const guides: Array<[string, string]> = [
  ["Try it in your browser", "/explain"],
  ["Download for Mac and Windows", "/beta"],
  ["Install help", "/install-help"],
  ["Changelog", "/releases"],
];

/**
 * /investors: the one-page story on the "pricing image" template (Design 2055 §7, ledger 562). Copy is the page's own
 * existing lines, Seed's facts block (agents/seed/investors-page-facts.md §1, with Security's MUST-F1/F2 fixes) and data
 * files only: amounts from compensation.ts, listings from listings.ts (live only, text, no badge images: Security 1849
 * B4 + 562 ruling), versions from milestones.ts. Left out until cleared, so not in the HTML at all:
 * - "Who's building it" (Seed §2): the same content as deck slide 11, on attorney hold (Security 2041).
 * - The pitch deck: attorney hold (Security 2039: no file, no link, no hidden markup).
 * - "We aren't raising a round" (Seed MUST-F3, Preston to answer); the runway table keeps its live wording.
 * - Press: none verifiable (Marketing + Inbox, 6 Nov), so the section doesn't render.
 * The YC row is gone (Preston 6 Nov).
 */
export default async function InvestorsPage() {
  const paymentsOpen = await fetchPaymentsOpen();
  const total = compensationTotalLabel();
  const credits = formatUsd(compensationCreditsUsd());
  const cash = formatUsd(compensationCashUsd());
  const programs = compensationProgramCount();
  const outside = programsOutsideTotalCount();
  const rows = supportRows();
  const lead = rows[0];
  // each version once (the changelog repeats a few), newest first as the file is
  const versions = milestones.filter((m, i, all) => m.category === "PRODUCT" && m.figure?.startsWith("v") && all.findIndex((o) => o.figure === m.figure) === i);
  const latest = versions.slice(0, 5);

  return (
    <PhotoPage photo="investors" wide labelledBy="inv-h">
      <PhotoHead>
        <p className="dg__eyebrow">Unvibe for investors</p>
        <h1 id="inv-h" data-d-hero-rise="h1">The ownership layer for AI-written code.</h1>
        <p className="dg__lead" data-d-enter="" style={enterDelay(120)}>
          AI writes code faster than people can understand it. Unvibe sits beside the editor, explains what changed,
          checks that it stuck, and keeps the knowledge fresh as the code moves.
        </p>
        <div className="dg__actions" data-d-enter="" style={enterDelay(200)}>
          <a className="d-cta d-btn" href={MAIL}>Talk to us<BtnDot /></a>
          <Link className="d-pill-link d-btn" href="/beta">Try Unvibe free<BtnDot /></Link>
        </div>
        <dl className="dgi-stats" data-d-enter="" style={enterDelay(280)}>
          <div><dt>{total}</dt><dd>{compensationTotalPhrase()}</dd></div>
          <div><dt>{programs}</dt><dd>startup programs we&apos;re in</dd></div>
          <div><dt>{versions.length}</dt><dd>versions in the changelog, latest {BETA_INSTALL_VERSION}</dd></div>
          <div><dt>Mac and Windows</dt><dd>beta, free to download</dd></div>
        </dl>
      </PhotoHead>

      <section className="dg__card" aria-labelledby="inv-thesis" data-d-enter="">
        <p className="dg__eyebrow">The thesis</p>
        <h2 id="inv-thesis">Shipping is solved. Understanding is not.</h2>
        <div className="dgi-cols">
          <article><h3>Problem</h3><p>Developers ship AI-generated code faster than they can confidently explain or maintain it. Knowledge rots the moment the code changes.</p></article>
          <article><h3>Product</h3><p>Select code, press Control+U (Ctrl+Alt+U on Windows). A panel explains it at the depth you pick. Ask a follow-up; Test me asks up to 3 questions. After an agent changes a lot at once, Briefs lists what changed in a local git repo and marks up to three files that touch auth, billing, schema or infrastructure to read line by line.</p></article>
          <article><h3>Wedge</h3><p>A desktop layer that works beside Cursor, VS Code, Claude Code and Terminal instead of replacing the editor. Neutral across every agent.</p></article>
        </div>
      </section>

      <section className="dg__card" aria-labelledby="inv-shipped" data-d-enter="">
        <p className="dg__eyebrow">Commitments</p>
        <h2 id="inv-shipped" data-d-ink="">What shipped, and what&apos;s next.</h2>
        <ol className="dgi-releases">
          {latest.map((m) => (
            <li key={m.figure}><span className="dgi-mono">{m.figure}</span><span>{m.title}</span><time>{m.date}</time></li>
          ))}
        </ol>
        <p><Link href="/releases">Every release in the changelog <span aria-hidden="true">→</span></Link></p>
        <ol className="dgi-roadmap">
          {roadmap.map(([name, detail, state]) => (
            <li key={name} data-state={state}>
              <span className="dgi-pill">{state === "shipped" ? "Shipped" : state === "next" ? "Building next" : "After that"}</span>
              <strong>{name}</strong>
              <p>{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="dg__card" aria-labelledby="inv-stands" data-d-enter="">
        <p className="dg__eyebrow">Where it stands</p>
        <h2 id="inv-stands" data-d-ink="">The numbers so far.</h2>
        <ul className="dgi-facts">
          <li>Free download for Mac and Windows. No account, card or API key needed to start.</li>
          <li>Before anything is sent, Unvibe checks the selected code for keys and tokens on your computer, and a known key stops the request.</li>
          <li>Since mid-October, a CI test installs new releases on clean macOS and Windows machines and fails unless a real explanation completes.</li>
          <li>As of 5 November 2026: 8 installs from outside the team since 18 October (an install counts once the app was used), 4 on their own code, 0 came back on a later day. 0 paying.</li>
          <li>The Mac build isn&apos;t notarized by Apple yet.</li>
          <li>
            Free $0. Pro ${PRICING.proMonthly} a month or ${PRICING.proAnnual} a year. Teams ${PRICING.teamsSeatMonthly} a seat a month or ${PRICING.teamsSeatAnnual} a year ({PRICING.teamsMinSeats} to {PRICING.teamsMaxSeats} seats).
            {paymentsOpen ? null : " Pro and Teams aren't on sale yet."}
          </li>
          <li>Cost to serve: about $0.01 per hosted explanation (November 2026), with hard daily and monthly spending caps.</li>
        </ul>
      </section>

      <section className="dg__card" id="backing" aria-labelledby="inv-programs" data-d-enter="">
        <p className="dg__eyebrow">Startup programs</p>
        <h2 id="inv-programs" data-d-ink="">In {programs} startup programs.</h2>
        <ProgramList firstUse />
      </section>

      <section className="dg__card" id="support" aria-labelledby="inv-runway" data-d-enter="">
        <p className="dg__eyebrow">Resource runway</p>
        <h2 id="inv-runway" data-d-ink="">Where the {total} comes from.</h2>
        <p>Every source by name. Program credits and plan value {credits} · cash {cash}.{outside > 0 ? ` The other ${outside} programs are listed with their terms, outside the total.` : ""} Credits are not cash. Not a round.</p>
        <div className="dgi-table" role="table" aria-label="Support by source">
          <div className="dgi-row dgi-row--head" role="row">
            <span role="columnheader">Source</span><span role="columnheader">Amount</span><span role="columnheader">What it is</span><span role="columnheader">Status</span>
          </div>
          {rows.map((line) => (
            <div key={line.name} className={`dgi-row${line === lead ? " dgi-row--lead" : ""}`} role="row">
              <strong role="cell">{line.name}</strong>
              <span role="cell" className="dgi-amount">{line.amount}</span>
              <span role="cell">{line.detail}</span>
              <span role="cell"><span className="dgi-pill">{line.state}</span></span>
            </div>
          ))}
        </div>
      </section>

      {/* "Who's building it" goes here once the attorney clears deck slide 11 (Security 2041); the deck link too. */}

      <section className="dg__card" aria-labelledby="inv-listed" data-d-enter="">
        <p className="dg__eyebrow">Self-submitted directories</p>
        <h2 id="inv-listed" data-d-ink="">Listed on</h2>
        <ul className="lo-grid">
          {listingLinks.map((listing) => (
            <li key={listing.href} className="lo-card">
              <a href={listing.href} target="_blank" rel="noopener noreferrer">{listing.name}</a>
              <span className="lo-domain">{new URL(listing.href).hostname.replace(/^www\./, "")}</span>
            </li>
          ))}
        </ul>
        <p className="dgi-more"><Link href="/listed-on">All listings <span aria-hidden="true">→</span></Link></p>
      </section>

      <section className="dg__card" aria-labelledby="inv-guides" data-d-enter="">
        <p className="dg__eyebrow">Guides</p>
        <h2 id="inv-guides" data-d-ink="">Let&apos;s talk.</h2>
        <ul className="dgi-guides">
          {guides.map(([label, href]) => (
            <li key={href}><Link href={href}>{label} <span aria-hidden="true">→</span></Link></li>
          ))}
          <li><a href={MAIL}>{SUPPORT_EMAIL}</a></li>
        </ul>
      </section>
    </PhotoPage>
  );
}
