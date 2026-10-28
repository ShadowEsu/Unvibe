import { PROGRAM_NOTICES, startupPrograms, withMark } from "@/data/compensation";

/**
 * The startup programs by full name, plain text in our own type. Only MongoDB shows a logo: its official,
 * unmodified file, on a light chip in both themes, smaller than Unvibe's own mark. Shared by the homepage strip,
 * /investors and /about. `firstUse`: this list is the first mention of the names on the page, so marks carry
 * their notice (MongoDB®, GitLab™).
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
          <p className="paper-meta">Behind Unvibe</p>
          <h2 id="backing-title">Supported by <em>startup programs.</em></h2>
        </div>
        <div className="claude-startups">
          <span className="claude-startups__tag">Startup program</span>
          <p className="claude-startups__title">Unvibe is in <em>Claude for Startups.</em></p>
          <p className="claude-startups__copy">Anthropic&apos;s program for early startups. Credit details are on the <a href="/investors#backing">investors page</a>.</p>
        </div>
        {/* The hero line names only Claude for Startups, so this list is the first use of the other names. */}
        <ProgramList firstUse />
      </div>
    </section>
  );
}
