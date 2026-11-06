import { PROGRAM_NOTICES, startupPrograms, withMark } from "@/data/compensation";

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

