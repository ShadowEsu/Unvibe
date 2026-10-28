import { SALESFORCE_ATTRIBUTION, startupPrograms, withRegistration } from "@/data/compensation";

/**
 * The startup programs by full name, plain text in our own type. Only MongoDB shows its logo: its official,
 * unmodified file, on a light chip in both themes, smaller than Unvibe's own mark. Shared by the homepage strip,
 * /investors and /about.
 * `firstUse`: this list is the first mention of the names on the page, so registered marks carry ®.
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
                <img src={program.logo} alt={program.brand} width={1102} height={278} loading="lazy" decoding="async" />
              </span>
            ) : null}
            <span className="program-list__name">{firstUse ? withRegistration(program.program, program) : program.program}</span>
          </li>
        ))}
      </ul>
      <p className="program-list__fine">{SALESFORCE_ATTRIBUTION}</p>
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
          <h2 id="backing-title">Startup <em>programs.</em></h2>
          <p className="paper-lead">Read the <a className="paper-text-link" href="/investors">investor overview</a> for the product thesis, public cash figures, and what comes next.</p>
        </div>
        <ProgramList firstUse={false} />
      </div>
    </section>
  );
}
