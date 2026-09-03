import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Contact,
  GitBranch,
  Globe2,
  Mail,
  Play,
} from "lucide-react";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { InvestorBriefDemo } from "@/components/paper/InvestorBriefDemo";
import {
  compensationCashUsd,
  compensationCreditsUsd,
  compensationLines,
  formatUsd,
} from "@/data/compensation";

export const metadata: Metadata = {
  title: "Investors",
  description:
    "Unvibe is building the engineering knowledge layer for AI-assisted software teams.",
};

const VIDEO_URL = "https://www.youtube.com/watch?v=twSoiDAHqc4";
const DRIVE_DECK_URL =
  "https://drive.google.com/file/d/1QN2BJwDR16tcbFpTFgY_JMqEOM-Bb_sg/view?usp=drive_link";

const resources = [
  { label: "Founder video", detail: "Product and company story", href: VIDEO_URL, icon: Play },
  { label: "Investor deck", detail: "Company overview", href: DRIVE_DECK_URL, icon: FileText },
  {
    label: "Founder LinkedIn",
    detail: "Preston Susanto",
    href: "https://www.linkedin.com/in/preston-jay-susanto/",
    icon: Contact,
  },
  {
    label: "Founder portfolio",
    detail: "Background and work",
    href: "https://shadowesu.github.io/Resume_Portfolio/",
    icon: Globe2,
  },
  {
    label: "Share this brief",
    detail: "unvibe.site/investors",
    href: "https://unvibe.site/investors",
    icon: ArrowUpRight,
  },
];

const productStages = [
  {
    number: "01",
    status: "Private beta now",
    title: "Personal understanding",
    body: "Select code in any app, receive a context-aware explanation, test your understanding, and save the learning.",
  },
  {
    number: "02",
    status: "Founding-pilot roadmap",
    title: "Team memory",
    body: "Connect explanations to pull requests, decisions, concepts, and projects so knowledge survives beyond one person.",
  },
  {
    number: "03",
    status: "Enterprise direction",
    title: "Knowledge intelligence",
    body: "Give engineering leaders a quiet view of knowledge gaps, ownership risk, onboarding progress, and AI-heavy change.",
  },
];

const teamSignals = [
  ["Org overview", "Where understanding is strong, missing, or concentrated"],
  ["PR intelligence", "What changed, why it changed, and who verified it"],
  ["Shared knowledge", "Durable explanations tied to code and decisions"],
  ["Knowledge risk", "Simple, explainable signals for ownership and resilience"],
  ["Onboarding", "The concepts and decisions a new engineer needs next"],
  ["Ask Engineering", "Answers grounded in a team’s verified knowledge"],
];

export default function InvestorsPage() {
  const credits = formatUsd(compensationCreditsUsd());
  const cash = formatUsd(compensationCashUsd());
  const mixpanel = compensationLines.find((line) => line.name.startsWith("Mixpanel"));
  const mixpanelAmount = mixpanel ? formatUsd(mixpanel.amountUsd) : "$144,000";
  const otherLines = compensationLines.filter((line) => !line.name.startsWith("Mixpanel"));

  return (
    <article className="investor-page investor-page--knowledge">
      <header className="container-page investor-v2-hero">
        <div className="investor-v2-hero__copy">
          <p className="launch-label">Unvibe / investor brief</p>
          <h1>Engineering understanding<br />for the AI-written codebase.</h1>
          <p className="investor-v2-hero__lede">
            Unvibe is the engineering knowledge layer for AI-assisted teams. It helps
            developers understand changes now—and helps organizations preserve what
            their engineers learn for later.
          </p>
          <p className="investor-v2-hero__thesis">
            GitHub stores the code. Unvibe stores the understanding.
          </p>
          <div className="investor-v2-actions">
            <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer">
              <Play size={16} aria-hidden="true" /> Watch founder video
            </a>
            <a href={DRIVE_DECK_URL} target="_blank" rel="noopener noreferrer">
              <FileText size={16} aria-hidden="true" /> Open investor deck
            </a>
            <a href="mailto:preston@unvibe.site?subject=Unvibe%20investment%20conversation">
              <Mail size={16} aria-hidden="true" /> Contact founder
            </a>
          </div>
        </div>

        <aside className="investor-v2-hero__facts" aria-label="Company at a glance">
          <p className="launch-label">At a glance</p>
          <dl>
            <div><dt>Stage</dt><dd>Private beta</dd></div>
            <div><dt>Public release</dt><dd>September 15, 2026</dd></div>
            <div><dt>Initial buyer</dt><dd>AI-heavy software teams</dd></div>
            <div><dt>Ideal team</dt><dd>5–100 engineers</dd></div>
            <div><dt>Entry point</dt><dd>Desktop understanding layer</dd></div>
          </dl>
          <a href="/build">Follow the live build <ArrowRight size={13} aria-hidden="true" /></a>
        </aside>

        <figure className="investor-v2-hero__visual">
          <Image
            src="/product/overlay-editor.png"
            alt="Unvibe explaining selected code beside the editor"
            width={3024}
            height={1790}
            sizes="(max-width: 800px) 94vw, 1200px"
            priority
          />
          <figcaption>Current private beta: explanation depth, cited code, follow-up, Test Me, and saved learning.</figcaption>
        </figure>
      </header>

      <nav className="container-page investor-v2-resources" aria-label="Investor resources">
        {resources.map(({ label, detail, href, icon: Icon }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer">
            <Icon size={18} aria-hidden="true" />
            <span><strong>{label}</strong><small>{detail}</small></span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        ))}
      </nav>

      <section className="container-page investor-v2-category">
        <div>
          <p className="launch-label">The category</p>
          <h2>AI made code creation abundant. Understanding is becoming scarce.</h2>
        </div>
        <div className="investor-v2-category__copy">
          <p>
            Faster implementation does not remove the need to review, explain, maintain,
            and transfer ownership. It increases it. The more code teams produce with AI,
            the more engineering knowledge can disappear into chats, pull requests, and
            individual memory.
          </p>
          <p>
            Unvibe starts with the developer at the moment of change, then turns verified
            understanding into an organizational asset.
          </p>
        </div>
      </section>

      <section className="container-page investor-v2-stages" aria-label="Product expansion">
        {productStages.map((stage) => (
          <article key={stage.number}>
            <div><span>{stage.number}</span><small>{stage.status}</small></div>
            <h2>{stage.title}</h2>
            <p>{stage.body}</p>
          </article>
        ))}
      </section>

      <section className="container-page investor-v2-proof">
        <div className="investor-v2-proof__copy">
          <p className="launch-label">What works now</p>
          <h2>A personal product with a natural path into teams.</h2>
          <p>
            The private beta already captures the core behavior: explain selected code in
            context, choose the right depth, ask a follow-up, test understanding, and keep
            a local record. That individual loop becomes the source material for team memory.
          </p>
          <ul>
            <li>Desktop overlay beside Cursor, VS Code, and other apps</li>
            <li>Five explanation levels, from New to Expert</li>
            <li>Follow-up questions and a lightweight comprehension check</li>
            <li>Secret filtering before any remote request</li>
            <li>Local history, concepts, progress, and saved explanations</li>
          </ul>
        </div>
        <figure className="investor-v2-proof__image">
          <Image
            src="/product/dashboard.png"
            alt="Unvibe personal dashboard with recent explanations and learning progress"
            width={2368}
            height={1650}
            sizes="(max-width: 800px) 94vw, 58vw"
          />
          <figcaption>The current personal dashboard turns explanation activity into retained learning.</figcaption>
        </figure>
      </section>

      <section className="container-page investor-v2-team">
        <div className="investor-v2-section-heading">
          <div>
            <p className="launch-label">Teams intelligence / roadmap</p>
            <h2>Measure knowledge risk without measuring people.</h2>
          </div>
          <p>
            The B2B product is designed around simple, explainable signals—not employee
            scoring or surveillance. Founding pilots will shape which views create enough
            operational value to earn repeat use.
          </p>
        </div>
        <div className="investor-v2-team__grid">
          {teamSignals.map(([name, detail]) => (
            <article key={name}>
              <strong>{name}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </div>
        <div className="investor-v2-team__principles" aria-label="Teams design principles">
          <span><GitBranch size={15} aria-hidden="true" /> GitHub-first</span>
          <span>Human-verified provenance</span>
          <span>Simple counts, bars, and trends</span>
          <span>Not employee performance scoring</span>
        </div>
      </section>

      <InvestorBriefDemo />

      <section className="container-page investor-support investor-v2-support" id="support">
        <div className="investor-section-copy">
          <p className="launch-label">Operating support</p>
          <h2>Useful runway, stated plainly.</h2>
          <p>
            Startup-program subscriptions and credits reduce operating costs. They are not
            cash and are not presented as a funding round.
          </p>
          <dl className="investor-support__totals">
            <div><dt>Largest program line</dt><dd>{mixpanelAmount}</dd></div>
            <div><dt>Program credits</dt><dd>{credits}</dd></div>
            <div><dt>Cash committed</dt><dd>{cash}</dd></div>
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

      <section className="container-page investor-v2-founder">
        <div>
          <p className="launch-label">Founder</p>
          <h2>Building for ownership, not more generation.</h2>
          <p>
            Preston Susanto is a technical founder and EECS student building Unvibe from
            the product layer through distribution. The near-term company focus is design
            partners, retained product use, and evidence of paid B2B demand.
          </p>
        </div>
        <div className="investor-v2-founder__links">
          <a href="https://www.linkedin.com/in/preston-jay-susanto/" target="_blank" rel="noopener noreferrer">
            <Contact size={17} aria-hidden="true" /> LinkedIn <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <a href="https://shadowesu.github.io/Resume_Portfolio/" target="_blank" rel="noopener noreferrer">
            <Globe2 size={17} aria-hidden="true" /> Portfolio <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <a href="mailto:preston@unvibe.site?subject=Unvibe%20investment%20conversation">
            <Mail size={17} aria-hidden="true" /> Email Preston <ArrowRight size={14} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="container-page investor-v2-next">
        <p className="launch-label">What we are proving next</p>
        <div>
          <h2>Customer evidence over startup optics.</h2>
          <ol>
            <li><span>01</span><p><strong>Habit</strong> Developers return because understanding compounds.</p></li>
            <li><span>02</span><p><strong>Team pull</strong> Engineering leaders ask for shared knowledge and risk views.</p></li>
            <li><span>03</span><p><strong>Willingness to pay</strong> Founding pilots convert operational value into paid usage.</p></li>
          </ol>
        </div>
      </section>

      <section className="container-page investor-download investor-v2-download">
        <BetaInstall tone="page" />
      </section>
    </article>
  );
}
