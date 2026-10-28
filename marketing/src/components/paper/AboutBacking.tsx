import Link from "next/link";
import { ProgramList } from "@/components/paper/BackingStrip";
import { startupProgramsLine } from "@/data/compensation";

/**
 * /about: the startup programs (about-mission.md, backing section), names only, no totals.
 * Self-contained, with its own styles, so it can move into the rewritten /about as is.
 */
export function AboutBacking() {
  return (
    <section className="paper-wrap about-backing" aria-labelledby="about-backing-title">
      <h2 id="about-backing-title">Startup programs</h2>
      <p className="about-backing__lead">{startupProgramsLine()}.</p>
      <ProgramList firstUse={false} />
      <p className="about-backing__more">
        <Link href="/investors#backing">Every line is on the investors page.</Link>
      </p>
    </section>
  );
}
