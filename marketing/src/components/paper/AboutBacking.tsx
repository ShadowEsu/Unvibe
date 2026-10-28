import Link from "next/link";
import { SponsorLogo, sponsors } from "@/components/paper/BackingStrip";
import { compensationProgramCount, compensationTotalLabel } from "@/data/compensation";

/**
 * /about: the startup-program backing (about-mission.md, "Backed by startup programs"). Self-contained, with
 * its own styles, so it can move into the rewritten /about as is. Figures come from compensation.ts, like /investors.
 */
export function AboutBacking() {
  return (
    <section className="paper-wrap about-backing" aria-labelledby="about-backing-title">
      <h2 id="about-backing-title">Backed by startup programs</h2>
      <ul className="about-backing__facts">
        <li>
          <b>{compensationTotalLabel()}</b> in startup support ({compensationProgramCount()} programs plus committed cash)
        </li>
        <li>
          In <b>Claude for Startups</b>
        </li>
      </ul>
      <ul className="about-backing__logos" aria-label="Startup program logos">
        {sponsors.map((sponsor) => (
          <li className="paper-partners__item" key={sponsor.name}>
            <SponsorLogo sponsor={sponsor} />
          </li>
        ))}
      </ul>
      <p className="about-backing__more">
        <Link href="/investors#backing">Every line is on the investors page.</Link>
      </p>
    </section>
  );
}
