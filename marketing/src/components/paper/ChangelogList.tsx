import { changelogArchive, changelogEntries, type Milestone } from "@/data/milestones";

interface ChangelogListProps {
  items?: Milestone[];
  limit?: number;
  /** Keep this many entries open and fold the older ones into one closed group per month. */
  expanded?: number;
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

function Entry({ item }: { item: Milestone }) {
  return (
    <article className={item.pinned ? "is-pinned" : undefined}>
      <div>
        <p className="paper-meta">{item.category}</p>
        <h3>
          {item.pinned ? (
            <span className="paper-log__star" role="img" aria-label="Highlighted">
              <StarMark />
            </span>
          ) : null}
          {item.title}
        </h3>
        <p className="paper-lead">{item.summary}</p>
      </div>
      <aside>
        {item.figure ? <strong>{item.figure}</strong> : null}
        <time>{item.date}</time>
      </aside>
    </article>
  );
}

const key = (item: Milestone) => `${item.date}-${item.title}`;

export function ChangelogList({ items, limit, expanded }: ChangelogListProps) {
  const list = items ?? (limit ? changelogEntries().slice(0, limit) : changelogEntries());
  if (expanded === undefined) {
    return (
      <div className="paper-log">
        {list.map((item) => <Entry key={key(item)} item={item} />)}
      </div>
    );
  }
  const { recent, months } = changelogArchive(list, expanded);
  return (
    <>
      <div className="paper-log">
        {recent.map((item) => <Entry key={key(item)} item={item} />)}
      </div>
      {months.length ? (
        <div className="paper-log-archive">
          <h3 className="paper-log-archive__title">Earlier</h3>
          {months.map((month) => (
            <details key={month.label}>
              <summary>
                {month.label}
                <span>{month.items.length === 1 ? "1 entry" : `${month.items.length} entries`}</span>
              </summary>
              <div className="paper-log">
                {month.items.map((item) => <Entry key={key(item)} item={item} />)}
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </>
  );
}
