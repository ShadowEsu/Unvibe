import type { CSSProperties, ReactNode } from "react";
import {
  COURTS,
  EVALUATION_LEAD,
  GOOGLE_SHARE,
  INCIDENTS,
  INCIDENT_QUOTE,
  MANDATES,
  MAPPED,
  PITCH,
  PROBLEM_NOTE,
  RESEARCH,
  RESEARCH_TAKEAWAY,
  THESIS,
  VALUATIONS,
  VERDICTS,
  WONT_DO,
} from "@/data/problem";
import { Os } from "./bits";
import { DownloadCta } from "./DownloadCta";
import { DiaMotion } from "./motion/DiaMotion";
import { ProblemStats, SourceLine, VerdictBoard } from "./Problem";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const PARTS = [
  { id: "ledger", n: "I", title: "The ledger" },
  { id: "big-tech", n: "II", title: "Big tech is vibe coding too" },
  { id: "money", n: "III", title: "Lawsuits and money" },
  { id: "limits", n: "IV", title: "The limits, measured" },
  { id: "evaluation", n: "V", title: "The evaluation" },
  { id: "why", n: "VI", title: "Why I'm building Unvibe" },
] as const;

type PartId = (typeof PARTS)[number]["id"];

function PartHead({ id }: { id: PartId }) {
  const part = PARTS.find((p) => p.id === id);
  return (
    <h2 id={`wn-${id}`} className="wn__h2" data-d-enter="">
      <span className="wn__n" aria-hidden="true">{part?.n}.</span> {part?.title}
    </h2>
  );
}

function Ledger() {
  return (
    <ol className="wn-ledger">
      {INCIDENTS.map((incident, i) => (
        <li key={incident.who} className="wn-ledger__row" data-d-enter="" style={d(Math.min(i, 3) * 60)}>
          <p className="wn-ledger__when">{incident.when}</p>
          <p className="wn-ledger__who">{incident.who}</p>
          <div className="wn-ledger__what">
            <p>{incident.what}</p>
            <p className="wn-ledger__src"><SourceLine sources={incident.sources} /></p>
          </div>
          <p className="wn-ledger__damage"><span className="sr-only">Damage: </span>{incident.damage}</p>
        </li>
      ))}
    </ol>
  );
}

function ShareFigure() {
  return (
    <figure className="wn-fig" data-d-enter="">
      <div className="wn-fig__bars">
        {GOOGLE_SHARE.bars.map((bar) => (
          <div key={bar.label} className="wn-fig__bar" style={{ "--v": bar.value / 100 } as CSSProperties}>
            <span className="wn-fig__value">{bar.display}</span>
            <span className="wn-fig__fill" aria-hidden="true" />
            <span className="wn-fig__label">{bar.label}</span>
          </div>
        ))}
      </div>
      <figcaption>{GOOGLE_SHARE.caption}. <SourceLine sources={GOOGLE_SHARE.sources} /></figcaption>
    </figure>
  );
}

/** A table that may scroll sideways on a phone, so it is a labelled region the keyboard can focus and scroll. */
function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="wn-table" data-d-enter="" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

function Research() {
  return (
    <TableScroll label="Research findings">
      <table>
        <thead>
          <tr><th scope="col">Finding</th><th scope="col">Number</th><th scope="col">Source</th></tr>
        </thead>
        <tbody>
          {RESEARCH.map((row) => (
            <tr key={row.finding}>
              <td>{row.finding}</td>
              <td className="wn-table__num">{row.number}</td>
              <td><SourceLine sources={row.sources} prefix={null} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function Evaluation() {
  return (
    <TableScroll label="Evaluation of every incident">
      <table>
        <thead>
          <tr><th scope="col">Incident</th><th scope="col">Root cause</th><th scope="col">Verdict</th></tr>
        </thead>
        <tbody>
          {INCIDENTS.map((incident) => (
            <tr key={incident.who}>
              <td>{incident.who}</td>
              <td>{incident.rootCause}</td>
              <td><span className="wn-verdict" data-verdict={incident.verdict}>{VERDICTS[incident.verdict].label}{incident.verdictNote ? ` · ${incident.verdictNote}` : ""}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

/**
 * /why: the founder's note "Nobody Read the Code" as one long page. Every figure and source comes from
 * src/data/problem.ts; the H1 only rises (it's the LCP) and the rest blurs in as it arrives (dia-motion.css).
 */
export function WhyNote() {
  return (
    <div className="d d-page wn">
      <DiaMotion />
      <article aria-labelledby="wn-h">
        <header className="wn__hero">
          <div className="wn__hero-in">
            <p className="wn__kicker">{PROBLEM_NOTE.kicker} · <time dateTime={PROBLEM_NOTE.dateTime}>{PROBLEM_NOTE.date}</time></p>
            <h1 id="wn-h" className="wn__h1" data-d-hero-rise="h1">{PROBLEM_NOTE.title}</h1>
            <p className="wn__sub" data-d-enter="" style={d(80)}>{PROBLEM_NOTE.subtitle}</p>
            <p className="wn__standfirst" data-d-enter="" style={d(160)}>{PROBLEM_NOTE.standfirst}</p>
            <ProblemStats />
          </div>
        </header>

        <nav className="wn__toc" aria-label="In this note">
          <ol>
            {PARTS.map((p) => (
              <li key={p.id}><a href={`#${p.id}`}><span aria-hidden="true">{p.n}.</span> {p.title}</a></li>
            ))}
          </ol>
        </nav>

        <section id="ledger" className="wn__part" aria-labelledby="wn-ledger">
          <PartHead id="ledger" />
          <h3 className="wn__h3" data-d-enter="">Fourteen incidents, one pattern</h3>
          <p className="wn__p" data-d-enter="">Every one of these is publicly documented. Where a company disputes the account, I say so.</p>
          <Ledger />
          <figure className="wn-quote" data-d-enter="">
            <blockquote><p>{`\u201C${INCIDENT_QUOTE.text}\u201D`}</p></blockquote>
            <figcaption>{INCIDENT_QUOTE.by}</figcaption>
          </figure>
        </section>

        <section id="big-tech" className="wn__part" aria-labelledby="wn-big-tech">
          <PartHead id="big-tech" />
          <div className="wn__split">
            <div>
              <h3 className="wn__h3" data-d-enter="">{GOOGLE_SHARE.title}</h3>
              <p className="wn__p" data-d-enter="">{GOOGLE_SHARE.body}</p>
            </div>
            <ShareFigure />
          </div>
          <h3 className="wn__h3" data-d-enter="">{MANDATES.title}</h3>
          <p className="wn__p" data-d-enter="">{MANDATES.lead}</p>
          <dl className="wn-list" data-d-enter="">
            {MANDATES.items.map((item) => (
              <div key={item.who}><dt>{item.who}</dt><dd>{item.text}</dd></div>
            ))}
          </dl>
        </section>

        <section id="money" className="wn__part" aria-labelledby="wn-money">
          <PartHead id="money" />
          <h3 className="wn__h3" data-d-enter="">{COURTS.title}</h3>
          <p className="wn__p" data-d-enter="">{COURTS.body}</p>
          <dl className="wn-figures" data-d-enter="">
            {COURTS.exposure.map((row) => (
              <div key={row.figure}><dt>{row.figure}</dt><dd>{row.text}</dd></div>
            ))}
          </dl>
          <h3 className="wn__h3" data-d-enter="">{VALUATIONS.title}</h3>
          <p className="wn__p" data-d-enter="">{VALUATIONS.body}</p>
          <p className="wn__src" data-d-enter=""><SourceLine sources={VALUATIONS.sources} prefix="Sources" /></p>
        </section>

        <section id="limits" className="wn__part" aria-labelledby="wn-limits">
          <PartHead id="limits" />
          <h3 className="wn__h3" data-d-enter="">What the research says</h3>
          <Research />
          <p className="wn__pull" data-d-enter="">{RESEARCH_TAKEAWAY}</p>
        </section>

        <section id="evaluation" className="wn__part" aria-labelledby="wn-evaluation">
          <PartHead id="evaluation" />
          <h3 className="wn__h3" data-d-enter="">Would understanding the code have stopped it?</h3>
          <p className="wn__p" data-d-enter="">{EVALUATION_LEAD}</p>
          <div className="wn__board"><VerdictBoard level={4} /></div>
          <Evaluation />
        </section>

        <section id="why" className="wn__part" aria-labelledby="wn-why">
          <PartHead id="why" />
          <h3 className="wn__h3" data-d-enter="">The thesis</h3>
          {THESIS.map((p) => <p key={p} className="wn__p" data-d-enter="">{p}</p>)}
          <p className="wn__p" data-d-enter="">{PITCH.before}<Os v={PITCH.shortcut} />{PITCH.after}</p>
          <h3 className="wn__h3" data-d-enter="">Mapped to the failures</h3>
          <dl className="wn-map" data-d-enter="">
            {MAPPED.map((row) => (
              <div key={row.failure}>
                <dt>{row.failure} <span>({row.cases})</span></dt>
                <dd>{row.answer}</dd>
              </div>
            ))}
          </dl>
          <h3 className="wn__h3" data-d-enter="">What it won&rsquo;t do</h3>
          <p className="wn__p" data-d-enter="">{WONT_DO}</p>
          <div className="wn__cta" data-d-enter="">
            <DownloadCta surface="why" className="d-cta d-btn d-btn--lg">Download Unvibe for free</DownloadCta>
            <p className="d-avail">Available for macOS and Windows</p>
          </div>
        </section>
      </article>
    </div>
  );
}
