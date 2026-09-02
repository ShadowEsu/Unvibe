import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/redesign/Reveal";

const metrics = [
  { label: "Team understanding", value: "74%", width: "74%", delta: "↑ 6%" },
  { label: "Understanding gap", value: "14 pts", width: "36%", delta: "↓ 8 pts" },
  { label: "Knowledge freshness", value: "69%", width: "69%", delta: "↑ 4%" },
] as const;

export function TeamsPreview({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "paper-teams paper-teams--compact" : "paper-section paper-teams"} id={compact ? undefined : "teams"}>
      <div className="paper-wrap paper-teams__grid">
        <Reveal className="paper-teams__copy">
          <p className="paper-meta">Unvibe Teams · Founding pilot</p>
          <h2>Code changes fast. Shared understanding should keep up.</h2>
          <p className="paper-lead">Connect GitHub, turn meaningful changes into shared context, and see where knowledge is missing, stale, or concentrated—without ranking engineers.</p>
          <ul className="paper-teams__pillars">
            <li><strong>Understand changes</strong><span>PR walkthroughs and project-grounded explanations.</span></li>
            <li><strong>Preserve knowledge</strong><span>Verified context linked to repositories, systems, and concepts.</span></li>
            <li><strong>See knowledge risk</strong><span>Transparent coverage, freshness, and concentration signals.</span></li>
          </ul>
          {!compact ? <div className="paper-teams__actions"><Link href="/teams">Explore Teams <ArrowRight size={16} /></Link><a href="/?utm_campaign=teams_pilot#waitlist">Join the founding pilot</a></div> : null}
        </Reveal>
        <Reveal className="paper-teams__dashboard paper-glass">
          <div className="paper-teams__dashboard-head"><span>ACME ENGINEERING</span><b>PILOT PREVIEW</b></div>
          {metrics.map((metric) => (
            <div className="paper-teams__metric" key={metric.label}>
              <div><span>{metric.label}</span><strong>{metric.value}</strong></div>
              <div className="paper-teams__bar" aria-hidden="true"><span style={{ width: metric.width }} /></div>
              <small>{metric.delta}</small>
            </div>
          ))}
          <div className="paper-teams__risk"><span>Knowledge risk</span><strong>MEDIUM</strong></div>
          <p>Illustrative preview. A score appears only when enough source evidence exists, with a visible “Why?” explanation.</p>
        </Reveal>
      </div>
    </section>
  );
}
