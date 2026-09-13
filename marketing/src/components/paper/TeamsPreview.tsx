import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/redesign/Reveal";

const activity = [
  { who: "maya@", what: "understood auth middleware", when: "2h ago" },
  { who: "jon@", what: "reviewed billing plans.ts", when: "yesterday" },
  { who: "alex@", what: "needs review on sync.ts", when: "yesterday" },
] as const;

export function TeamsPreview({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "paper-teams paper-teams--compact" : "paper-section paper-teams"} id={compact ? undefined : "teams"}>
      <div className="paper-wrap paper-teams__grid">
        <Reveal className="paper-teams__copy">
          <p className="paper-meta">Unvibe Teams · Founding pilot</p>
          <h2>Share a workspace. See who reviewed what.</h2>
          <p className="paper-lead">
            Founding Teams today is a shared workspace with invites and a who-reviewed-what activity
            feed. Full explanation text stays on each person’s device. GitHub-connected intelligence
            is Pilot — not shipped yet.
          </p>
          <ul className="paper-teams__pillars">
            <li><strong>Shared workspace</strong><span>Create a team, invite seats, and work in one place.</span></li>
            <li><strong>Who reviewed what</strong><span>See who understood which file, concept, and project.</span></li>
            <li><strong>GitHub intelligence</strong><span>PR walkthroughs and knowledge-risk dashboards stay Pilot.</span></li>
          </ul>
          {!compact ? (
            <div className="paper-teams__actions">
              <Link href="/teams">Explore Teams <ArrowRight size={16} /></Link>
              <a href="mailto:preston@unvibe.site?subject=Unvibe%20Teams%20founding%20pilot">Request Teams seats</a>
            </div>
          ) : null}
        </Reveal>
        <Reveal className="paper-teams__dashboard paper-glass">
          <div className="paper-teams__dashboard-head"><span>TEAM ACTIVITY</span><b>SHIPPED IN PILOT</b></div>
          {activity.map((row) => (
            <div className="paper-teams__metric" key={`${row.who}-${row.what}`}>
              <div><span>{row.who}</span><strong>{row.when}</strong></div>
              <p style={{ margin: "4px 0 0", fontSize: "14px" }}>{row.what}</p>
            </div>
          ))}
          <div className="paper-teams__risk"><span>GitHub intelligence</span><strong>PILOT</strong></div>
          <p>Illustrative activity feed. PR dashboards and knowledge-risk scores are not current claims.</p>
        </Reveal>
      </div>
    </section>
  );
}
