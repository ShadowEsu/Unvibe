import { PROGRAM_NOTICES, startupPrograms, withMark } from "@/data/compensation";
import { Arrive } from "@/components/paper/Arrive";

/**
 * The startup programs by full name, plain text in our own type. Only MongoDB shows a logo: its official,
 * unmodified file, on a light chip in both themes, smaller than Unvibe's own mark. Shared by /investors
 * and /about. `firstUse`: this list is the first mention of the names on the page, so marks carry
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

/**
 * Homepage strip: one line and the investors link (Design 466). The full program list, with its notices,
 * is on /investors and /about; with no other program named here, no trademark notice is needed.
 */
export function BackingStrip() {
  return (
    <section id="backing" className="paper-section paper-backing" aria-labelledby="backing-title">
      <Arrive className="arrive--plate">
        <div className="paper-wrap u-sheet">
          <div className="claude-startups">
            <p className="claude-startups__title" id="backing-title">Unvibe is in Claude for Startups.</p>
            <p className="claude-startups__copy">Credit details are on the <a href="/investors#backing">investors page</a>.</p>
          </div>
        </div>
      </Arrive>
    </section>
  );
}
