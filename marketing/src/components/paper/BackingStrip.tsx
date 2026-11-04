import { PROGRAM_NOTICES, startupPrograms, withMark } from "@/data/compensation";
import { GlassPlate } from "@/components/glass/GlassPlate";

/**
 * The startup programs by full name, plain text in our own type. Only MongoDB shows a logo: its official,
 * unmodified file, on a light chip in both themes, smaller than Unvibe's own mark. Shared by the homepage strip,
 * /investors and /about. `firstUse`: this list is the first mention of the names on the page, so marks carry
 * their notice (MongoDB®).
 */
export function ProgramList({ firstUse }: { firstUse: boolean }) {
  return (
    <div className="program-list">
      <ul className="program-list__items" aria-label="Startup programs">
        {startupPrograms.map((program) => (
          <li className="program-list__item" key={program.program}>
            {program.logo ? (
              <span className="program-list__logo">
                {/* eslint-disable-next-line @next/next/no-img-element -- next/image never optimizes SVGs */}
                <img src={program.logo.src} alt={program.brand} width={program.logo.width} height={program.logo.height} loading="lazy" decoding="async" />
              </span>
            ) : null}
            <span className="program-list__name">{firstUse ? withMark(program.program, program) : program.program}</span>
          </li>
        ))}
      </ul>
      <p className="program-list__fine">{PROGRAM_NOTICES.join(" ")}</p>
    </div>
  );
}

/** Homepage strip: the startup programs Unvibe is in. Programs, not partnerships, so the label says so. */
export function BackingStrip() {
  return (
    <section id="backing" className="paper-section paper-backing" aria-labelledby="backing-title">
      <div className="paper-wrap u-sheet">
        <div className="sec-head">
          <h2 id="backing-title">Startup programs we&apos;re in.</h2>
        </div>
        {/* One glass panel holds the programs; the sheet around it is clear. */}
        <div className="backing-panel">
          <GlassPlate />
          <div className="claude-startups">
            <span className="claude-startups__tag">Startup program</span>
            <p className="claude-startups__title">Unvibe is in Claude for Startups.</p>
            <p className="claude-startups__copy">Anthropic&apos;s program for early startups. Credit details are on the <a href="/investors#backing">investors page</a>.</p>
          </div>
          {/* The only other mention of a program name on the page is Claude for Startups above, so this list is the first use of the rest. */}
          <ProgramList firstUse />
        </div>
      </div>
    </section>
  );
}
