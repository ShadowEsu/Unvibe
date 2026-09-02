import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/Button";
import { TeamsPreview } from "@/components/paper/TeamsPreview";

export const metadata: Metadata = {
  title: "Teams",
  description: "Unvibe Teams turns code changes into shared, explainable engineering knowledge—with GitHub context and transparent knowledge-risk signals.",
};

const stages = [
  { status: "Founding pilot", title: "Understand meaningful changes", body: "GitHub-connected repository and PR context, project-grounded explanations, and explicit walkthrough evidence.", items: ["Organization and repository connection", "PR understanding", "Shared, verified context"] },
  { status: "Pilot roadmap", title: "Make understanding visible", body: "Simple percentages, bars, trends, and evidence counts—each with a visible explanation of what moved the number.", items: ["Team and repository coverage", "Knowledge matrix and freshness", "Concentration, risk, and Understanding Gap"] },
  { status: "Planned", title: "Act on the next gap", body: "Project-native recommendations that point to a real PR, architecture path, concept, or repository walkthrough.", items: ["Engineering onboarding", "Weekly knowledge brief", "Ask Engineering and architecture context"] },
] as const;

export default function TeamsPage() {
  return (
    <article className="launch-subpage teams-page">
      <header className="paper-photo-band teams-hero">
        <Image src="/hero/golden-gate.png" alt="" fill priority sizes="100vw" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Unvibe Teams · GitHub-first</p>
          <h1>Keep your engineering team ahead of its codebase.</h1>
          <p>Unvibe turns meaningful code changes into shared knowledge, then shows where understanding is missing, stale, or concentrated.</p>
          <div className="teams-hero__actions"><Button href="/?utm_campaign=teams_pilot#waitlist" size="lg">Join the founding pilot</Button><Button href="/#product" variant="secondary" size="lg">See the personal product</Button></div>
        </div>
      </header>

      <TeamsPreview compact />

      <section className="paper-section teams-roadmap">
        <div className="paper-wrap">
          <div className="paper-center teams-roadmap__intro"><p className="paper-meta">A measured rollout</p><h2>One useful layer at a time.</h2><p>The personal product remains the developer wedge. Teams turns verified understanding events into shared engineering intelligence.</p></div>
          <div className="teams-roadmap__grid">
            {stages.map((stage) => <article className="paper-glass" key={stage.title}><span>{stage.status}</span><h3>{stage.title}</h3><p>{stage.body}</p><ul>{stage.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}
          </div>
        </div>
      </section>

      <section className="paper-section teams-principles">
        <div className="paper-wrap teams-principles__grid">
          <div><p className="paper-meta">Evidence, not surveillance</p><h2>Understanding coverage is not employee performance.</h2><p>Commit activity can establish familiarity, but it never proves comprehension. Unvibe uses explicit evidence, shows why a score changed, and says “Not enough data” when the evidence is thin.</p></div>
          <div className="paper-glass"><strong>Every Teams metric must:</strong><ul><li>Expose its contributing evidence and weights.</li><li>Separate source evidence from AI inference.</li><li>Avoid leaderboards and “good/bad engineer” labels.</li><li>Handle loading, missing-data, error, and insufficient-evidence states.</li></ul></div>
        </div>
      </section>

      <section className="paper-section teams-enterprise">
        <div className="paper-wrap paper-center"><p className="paper-meta">Enterprise roadmap</p><h2>Governance comes after the useful foundation.</h2><p>Organization intelligence, policies, permissions, audit events, and retention controls are planned. SSO/SAML, SCIM, BYOK, VPC deployment, data residency, and SLA support are later-stage capabilities—not current claims.</p><div className="teams-hero__actions"><Button href="/pricing" size="lg">See plans and status</Button><Button href="mailto:preston@unvibe.site?subject=Unvibe%20Teams%20pilot" variant="secondary" size="lg">Talk about your team</Button></div></div>
      </section>
    </article>
  );
}
