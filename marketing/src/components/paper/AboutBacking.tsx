import Link from "next/link";
import { ProgramList } from "@/components/paper/BackingStrip";
import { compensationTotalLabel, compensationTotalPhrase, programsWithoutAmountCount, startupProgramsLine } from "@/data/compensation";

/**
 * /about: the startup programs (about-mission.md). Self-contained, with its own styles, so it can move into the
 * rewritten /about as is. Figures come from compensation.ts, like /investors.
 */
export function AboutBacking() {
  return (
    <section className="paper-wrap about-backing" aria-labelledby="about-backing-title">
      <h2 id="about-backing-title">Startup programs we&apos;re in</h2>
      <p className="about-backing__lead">
        <b>{compensationTotalLabel()}</b> {compensationTotalPhrase()}, plus {programsWithoutAmountCount()} more startup programs listed without an amount.
      </p>
      <p className="about-backing__lead">{startupProgramsLine()}.</p>
      <ProgramList firstUse={false} />
      <p className="about-backing__more">
        <Link href="/investors#backing">More on the investors page.</Link>
      </p>
    </section>
  );
}
