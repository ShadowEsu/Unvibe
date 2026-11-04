import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Arrive } from "@/components/paper/Arrive";
import { ChangelogHashOpen } from "@/components/paper/ChangelogHashOpen";
import { changelogAnchors, changelogArchive, changelogEntries, type Milestone } from "@/data/milestones";

interface ChangelogListProps {
  items?: Milestone[];
  limit?: number;
  /** Keep this many entries open under "Latest" and fold the older ones into one closed group per month. */
  expanded?: number;
  /** The first 8 open entries arrive one after another when the list first scrolls into view (/releases). */
  arrive?: boolean;
}

function StarMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.8 14.3 9h7l-5.6 4.1 2.1 6.4L12 15.7 6.2 19.5 8.3 13.1 2.7 9h7L12 2.8Z"
      />
    </svg>
  );
}

function Entry({ item, id, Heading = "h3" }: { item: Milestone; id?: string; Heading?: "h3" | "h4" }) {
  return (
    <article id={id} className={item.pinned ? "is-pinned" : undefined}>
      <div>
        <p className="paper-meta">{item.category}</p>
        <Heading>
          {item.pinned ? (
            <span className="paper-log__star" role="img" aria-label="Highlighted">
              <StarMark />
            </span>
          ) : null}
          {item.title}
        </Heading>
        <p className="paper-lead">{item.summary}</p>
      </div>
      <aside>
        {item.figure ? <strong>{item.figure}</strong> : null}
        <time>{item.date}</time>
      </aside>
    </article>
  );
}

/** The open list: staggered in with Arrive when asked, otherwise a plain list. */
function OpenLog({ arrive, children }: { arrive: boolean; children: ReactNode }) {
  return arrive ? <Arrive className="paper-log">{children}</Arrive> : <div className="paper-log">{children}</div>;
}

export function ChangelogList({ items, limit, expanded, arrive = false }: ChangelogListProps) {
  const list = items ?? (limit ? changelogEntries().slice(0, limit) : changelogEntries());
  if (expanded === undefined) {
    return <OpenLog arrive={arrive}>{list.map((item) => <Entry key={`${item.date}-${item.title}`} item={item} />)}</OpenLog>;
  }
  const anchors = changelogAnchors(list);
  const anchorOf = new Map(list.map((item, index) => [item, anchors[index]]));
  const { recent, months } = changelogArchive(list, expanded);
  return (
    <>
      <h3 className="paper-log-group__title">Latest</h3>
      <OpenLog arrive={arrive}>
        {recent.map((item) => <Entry key={anchorOf.get(item)} id={anchorOf.get(item)} item={item} Heading="h4" />)}
      </OpenLog>
      {months.length ? (
        <div className="paper-log-archive">
          <h3 className="paper-log-group__title">Earlier</h3>
          {months.map((month) => (
            <details key={month.label}>
              <summary>
                <span className="paper-log-archive__month">{month.label}</span>
                <span className="paper-log-archive__count">
                  {month.items.length === 1 ? "1 entry" : `${month.items.length} entries`}
                  <ChevronDown aria-hidden="true" size={18} strokeWidth={2} />
                </span>
              </summary>
              <div className="paper-log">
                {month.items.map((item) => <Entry key={anchorOf.get(item)} id={anchorOf.get(item)} item={item} Heading="h4" />)}
              </div>
            </details>
          ))}
          <ChangelogHashOpen />
        </div>
      ) : null}
    </>
  );
}
