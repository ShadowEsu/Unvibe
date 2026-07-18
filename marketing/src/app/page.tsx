import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Brain,
  BookOpen,
  Check,
  CircleHelp,
  Code2,
  CreditCard,
  Eye,
  FileCode2,
  FolderGit2,
  GraduationCap,
  History as HistoryIcon,
  LockKeyhole,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { Button } from "@/components/Button";
import { FaqJsonLd } from "@/components/JsonLd";
import { HeroDemo } from "@/components/redesign/HeroDemo";
import { LevelLab } from "@/components/redesign/LevelLab";
import { ContextLadder } from "@/components/redesign/ContextLadder";
import { PageIntro } from "@/components/redesign/PageIntro";
import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";
import { Reveal } from "@/components/redesign/Reveal";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { faqItems } from "@/data/faq";

const tools = ["Cursor", "VS Code", "Terminal", "Claude Code", "GitHub"];

const companionDestinations = [
  { icon: BookOpen, title: "Study", detail: "A short review queue formed from concepts you have actually met in your code." },
  { icon: HistoryIcon, title: "History", detail: "A private, chronological trail of explanations and checks you chose to keep." },
  { icon: CircleHelp, title: "Quiz", detail: "Fresh comprehension checks inside real explanations, where the code context is present." },
  { icon: BarChart3, title: "Progress", detail: "Cautious evidence, streaks, and learning signals—never made-up mastery scores." },
  { icon: CreditCard, title: "Plan", detail: "Usage, reset dates, and the Free or Pro space that fits your work." },
];

export default function Home() {
  return (
    <>
      <FaqJsonLd />
      <PageIntro />

      <section className="pixel-hero" id="product">
        <div className="hero-pixels hero-pixels-left" aria-hidden="true" />
        <div className="hero-pixels hero-pixels-right" aria-hidden="true" />
        <Reveal className="container-page pixel-hero-inner">
          <p className="pixel-eyebrow"><span className="brand-pixel" aria-hidden="true" />A learning layer for AI-generated code</p>
          <h1>Don&apos;t feel guilty about vibe coding. <em>Make the code yours.</em></h1>
          <p className="hero-positioning">AI writes the code. <strong>Unvibe helps you understand it.</strong></p>
          <p className="hero-support">Select code, choose your explanation depth, and learn how it works without leaving your workflow.</p>
          <div className="hero-actions">
            <Button href="#waitlist" size="lg" className="beta-button">Join the private beta <ArrowRight size={18} /></Button>
            <Button href="#demo" size="lg" variant="secondary">See Unvibe in action <ArrowDown size={17} /></Button>
          </div>
          <p className="hero-micro">Mac first <i /> Early beta <i /> Free to join <i /> No credit card</p>
          <div id="demo" className="hero-demo-wrap"><HeroDemo /></div>
        </Reveal>
      </section>

      <section className="problem-field" id="why">
        <Reveal className="container-page">
          <p className="section-number light">01 / THE PROBLEM</p>
          <div className="center-intro light-copy">
            <h2>Your agent finished the feature.<br /><em>Could you explain it tomorrow?</em></h2>
            <p>Using AI is not the problem. Losing the thread of your own project is.</p>
          </div>
          <div className="before-after">
            <article className="state-panel before-panel">
              <div className="state-heading"><span>Before</span><b>Task complete ✓</b></div>
              <div className="file-stack" aria-hidden="true">
                <i>+14 files</i><i>useSync.ts</i><i>cache.ts</i><i>Editor.tsx</i>
              </div>
              <ul>
                <li><span>?</span>Unfamiliar abstractions</li>
                <li><span>?</span>Unexplained dependencies</li>
                <li><span>?</span>Possible failure points</li>
              </ul>
              <p className="uncertain"><Eye size={16} /> It works. You think.</p>
            </article>
            <div className="pixel-transfer" aria-hidden="true"><i /><i /><i /><ArrowRight /></div>
            <article className="state-panel after-panel">
              <div className="state-heading"><span>After Unvibe</span><b>Context found</b></div>
              <div className="after-grid">
                {[
                  ["What changed", "Draft state now follows the active ID."],
                  ["Why", "Prevents state leaking across documents."],
                  ["Files involved", "3 modules · 1 hook · 2 call sites"],
                  ["Next concept", "Effect dependencies"],
                ].map(([title, body]) => <div key={title}><Check size={15} /><strong>{title}</strong><p>{body}</p></div>)}
              </div>
            </article>
          </div>
        </Reveal>
      </section>

      <section className="how-field" id="how-it-works">
        <Reveal className="container-page">
          <p className="section-number">02 / ONE QUIET LOOP</p>
          <div className="center-intro">
            <h2>From generated to <em>genuinely understood.</em></h2>
            <p>Three steps. Then you keep building.</p>
          </div>
          <div className="steps-editorial">
            <article><span>01</span><MousePointer2 /><h3>Select code</h3><p>Choose the exact lines, file, or git change you want to understand.</p><div className="step-art select-art"><i /><i /><i /></div></article>
            <article><span>02</span><Brain /><h3>Choose your level</h3><p>Start plain, go deep, or switch level whenever the explanation misses.</p><div className="step-art depth-art"><i /><i /><i /><i /><i /></div></article>
            <article><span>03</span><Code2 /><h3>Understand. Continue.</h3><p>Ask a follow-up, test yourself, save the concept, and get back to the project.</p><div className="step-art continue-art"><i /><ArrowRight /></div></article>
          </div>
        </Reveal>
      </section>

      <section className="level-field" id="learn">
        <Reveal className="container-page">
          <p className="section-number">03 / YOUR DEPTH</p>
          <div className="split-intro">
            <h2>The same code.<br /><em>Five ways in.</em></h2>
            <p>Good explanations meet you where you are. Change the level to compare language, execution flow, architecture, and tradeoffs.</p>
          </div>
          <LevelLab />
        </Reveal>
      </section>

      <section className="context-field" id="context">
        <Reveal className="container-page">
          <p className="section-number light">04 / THE WHOLE THREAD</p>
          <div className="center-intro light-copy">
            <h2>A line rarely makes sense <em>by itself.</em></h2>
            <p>Move outward from expression to architecture, then turn the missing context into something learnable.</p>
          </div>
          <ContextLadder />
        </Reveal>
      </section>

      <section className="tools-field" id="tools">
        <Reveal className="container-page">
          <p className="section-number">05 / STAY IN FLOW</p>
          <div className="center-intro">
            <h2>Beside the tools.<br /><em>Not another place to work.</em></h2>
            <p>Unvibe is a Mac desktop layer designed to stay available beside your coding workflow.</p>
          </div>
          <div className="tool-orbit">
            <div className="tool-center"><span className="brand-pixel" /><strong>Unvibe</strong><small>Mac desktop layer</small></div>
            {tools.map((tool, index) => <div className={`tool-node tool-${index + 1}`} key={tool}><TerminalSquare size={17} /><span>{tool}</span></div>)}
          </div>
          <p className="disclosure">Tool names describe intended workflows, not partnerships or endorsements. Specific integrations may be in development.</p>
        </Reveal>
      </section>

      <section className="curriculum-field" id="curriculum">
        <Reveal className="container-page curriculum-grid">
          <div>
            <p className="section-number light">06 / LEARN FROM REAL WORK</p>
            <h2>Your project becomes <em>the curriculum.</em></h2>
            <p className="curriculum-lead">No generic tutorial can know the decisions inside your repository. Unvibe ties learning to the code you actually need to maintain.</p>
            <div className="audience-list">
              <span><GraduationCap />Students learning inside real projects</span>
              <span><Sparkles />AI-first builders closing knowledge gaps</span>
              <span><FileCode2 />Developers reviewing unfamiliar changes</span>
              <span><FolderGit2 />Leads tracing architecture and risk</span>
            </div>
          </div>
          <div className="curriculum-board">
            <div className="project-tree">
              <span>my-app/</span><span>├─ src/hooks/useSyncedDraft.ts</span><span>├─ src/cache/drafts.ts</span><span>└─ src/editor/Editor.tsx</span>
            </div>
            <ArrowDown className="board-arrow" />
            <div className="learning-cards">
              <article><small>CONCEPT</small><strong>Effect dependencies</strong><span>Seen in 3 files</span></article>
              <article><small>CHECK</small><strong>Why can state drift?</strong><span>Ready to test</span></article>
              <article className="planned-card"><small>LEARNING EVIDENCE</small><strong>Developing</strong><span>Coming during beta</span></article>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="companion-field" id="companion">
        <Reveal className="container-page">
          <p className="section-number">07 / KEEP THE THREAD</p>
          <div className="center-intro">
            <h2>Five places to keep <em>learning moving.</em></h2>
            <p>The desktop companion turns each real review into a path back to understanding—without pretending you have completed a course you never took.</p>
          </div>
          <div className="companion-grid">
            {companionDestinations.map(({ icon: Icon, title, detail }, index) => <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span><Icon size={22} /><h3>{title}</h3><p>{detail}</p>
            </article>)}
          </div>
          <p className="companion-note">Your sixth destination is Plan: start free, see what resets, and only upgrade when your projects need more room.</p>
        </Reveal>
      </section>

      <section className="privacy-field" id="privacy">
        <Reveal className="container-page privacy-layout">
          <div className="privacy-copy">
            <p className="section-number">08 / PRIVATE BY DESIGN</p>
            <h2>Your code deserves <em>a careful boundary.</em></h2>
            <p>Unvibe&apos;s desktop agent owns network requests. It filters likely secrets locally before approved context can be sent for an explanation.</p>
            <div className="legal-links"><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="/data-controls">Data controls</a></div>
          </div>
          <div className="privacy-diagram">
            <div><Code2 /><span>Your selected context</span><small>On your Mac</small></div>
            <span className="privacy-arrow"><ArrowRight /></span>
            <div className="filter-node"><ShieldCheck /><span>Local secret filter</span><small>.env · keys · tokens · builds</small></div>
            <span className="privacy-arrow"><ArrowRight /></span>
            <div><LockKeyhole /><span>Approved request</span><small>Filtered context only</small></div>
          </div>
          <p className="privacy-note">Per-repository payload preview and consent controls are in development. No secret filter can guarantee it catches every sensitive value.</p>
        </Reveal>
      </section>

      <section className="pricing-field" id="pricing">
        <Reveal className="container-page">
          <div className="pricing-copy">
            <p className="section-number">09 / PRICING</p>
            <h2>Start free. <em>Upgrade when your projects grow.</em></h2>
            <p>Free helps you understand a selection — 50 explanations each month, plus your spaced study queue. Pro adds git diffs, agent briefs, nearby files, and since-last-understood compares — 100 explanations each month.</p>
          </div>
          <PricingPlans />
        </Reveal>
      </section>

      <PixelWaitlist />

      <section className="faq-field" id="faq">
        <Reveal className="container-page faq-layout">
          <div className="faq-heading">
            <p className="section-number">11 / QUICK ANSWERS</p>
            <h2>Before you <em>join.</em></h2>
            <p>Clear expectations now make for a better beta later.</p>
          </div>
          <div className="faq-list">
            {faqItems.filter((item) => ["free", "pro-annual", "cancel"].includes(item.id)).map((item, index) => (
              <details key={item.id} open={index === 0}>
                <summary><span>{String(index + 1).padStart(2, "0")}</span>{item.question}<i aria-hidden="true" /></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="final-field">
        <div className="final-pixels" aria-hidden="true" />
        <Reveal className="container-narrow">
          <p className="pixel-eyebrow"><span className="brand-pixel" />KEEP THE SPEED. KEEP THE UNDERSTANDING.</p>
          <h2>AI can write the code.<br /><em>Make sure it becomes yours.</em></h2>
          <Button href="#waitlist" size="lg" className="beta-button">Join the private beta <ArrowRight size={18} /></Button>
          <p>Mac first · Free to join · Privacy and terms always available</p>
        </Reveal>
      </section>
    </>
  );
}
