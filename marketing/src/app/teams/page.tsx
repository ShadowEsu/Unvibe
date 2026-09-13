import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/Button";
import { TeamsPreview } from "@/components/paper/TeamsPreview";

export const metadata: Metadata = {
  title: "Teams",
  description:
    "Unvibe Teams founding pilot: shared workspace, invites, and who-reviewed-what activity. GitHub intelligence stays Pilot until it ships.",
};

const stages = [
  {
    status: "Available now",
    title: "Share the platform",
    body: "Create a team workspace, invite teammates, and see who reviewed or understood which file, concept, and project. Explanation text stays on each device.",
    items: ["Team workspace and invites", "Who-reviewed-what activity feed", "Authorship on shared metadata"],
  },
  {
    status: "Pilot",
    title: "Connect GitHub next",
    body: "Repository connection, PR walkthroughs, and transparent knowledge-risk signals are labeled Pilot. They are not included in the founding workspace today.",
    items: ["Organization and repository connection", "PR understanding", "Coverage, freshness, and Understanding Gap"],
  },
  {
    status: "Planned",
    title: "Act on the next gap",
    body: "Project-native recommendations that point to a real PR, architecture path, concept, or repository walkthrough — after the GitHub layer ships.",
    items: ["Engineering onboarding", "Weekly knowledge brief", "Ask Engineering and architecture context"],
  },
] as const;

export default function TeamsPage() {
  return (
    <article className="launch-subpage teams-page">
      <header className="paper-photo-band teams-hero">
        <Image src="/hero/golden-gate.png" alt="" fill priority sizes="100vw" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Unvibe Teams · Founding pilot</p>
          <h1>Share understanding as the team grows.</h1>
          <p>
            Start with a shared workspace and who-reviewed-what. GitHub-connected intelligence is
            next, and stays clearly labeled Pilot until it ships.
          </p>
          <div className="teams-hero__actions">
            <Button href="mailto:preston@unvibe.site?subject=Unvibe%20Teams%20founding%20pilot" size="lg" className="teams-cta teams-cta--dark">
              Request Teams seats
            </Button>
            <Button href="/#product" variant="secondary" size="lg" className="teams-cta teams-cta--light">
              See the personal product
            </Button>
          </div>
        </div>
      </header>

      <TeamsPreview compact />

      <section className="paper-section teams-roadmap">
        <div className="paper-wrap">
          <div className="paper-center teams-roadmap__intro">
            <p className="paper-meta">A measured rollout</p>
            <h2>One useful layer at a time.</h2>
            <p>
              The personal product remains the developer wedge. Teams starts with shared activity,
              then adds GitHub intelligence only when it is real — never as a silent claim.
            </p>
          </div>
          <div className="teams-roadmap__grid">
            {stages.map((stage) => (
              <article className="paper-glass" key={stage.title}>
                <span>{stage.status}</span>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
                <ul>{stage.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="paper-section teams-principles">
        <div className="paper-wrap teams-principles__grid">
          <div>
            <p className="paper-meta">Evidence, not surveillance</p>
            <h2>Understanding coverage is not employee performance.</h2>
            <p>
              Commit activity can establish familiarity, but it never proves comprehension. When
              GitHub intelligence ships, scores will use explicit evidence, show why a number moved,
              and say “Not enough data” when the evidence is thin.
            </p>
          </div>
          <div className="paper-glass">
            <strong>Every future Teams metric must:</strong>
            <ul>
              <li>Expose its contributing evidence and weights.</li>
              <li>Separate source evidence from AI inference.</li>
              <li>Avoid leaderboards and “good/bad engineer” labels.</li>
              <li>Handle loading, missing-data, error, and insufficient-evidence states.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="paper-section teams-enterprise">
        <div className="paper-wrap paper-center">
          <p className="paper-meta">Enterprise roadmap</p>
          <h2>Governance comes after the useful foundation.</h2>
          <p>
            Organization intelligence, policies, permissions, audit events, and retention controls
            are planned. SSO/SAML, SCIM, BYOK, VPC deployment, data residency, and SLA support are
            later-stage capabilities — not current claims.
          </p>
          <div className="teams-hero__actions">
            <Button href="/pricing" size="lg" className="teams-cta teams-cta--dark">
              See plans and status
            </Button>
            <Button href="mailto:preston@unvibe.site?subject=Unvibe%20Teams%20pilot" variant="secondary" size="lg" className="teams-cta teams-cta--light">
              Talk about your team
            </Button>
          </div>
        </div>
      </section>
    </article>
  );
}
