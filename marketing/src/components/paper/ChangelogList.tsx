import { changelogEntries, type Milestone } from "@/data/milestones";

interface ChangelogListProps {
  items?: Milestone[];
  limit?: number;
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

export function ChangelogList({ items, limit }: ChangelogListProps) {
  const list = items ?? (limit ? changelogEntries().slice(0, limit) : changelogEntries());
  return (
    <div className="paper-log">
      {list.map((item) => (
        <article key={`${item.date}-${item.title}`} className={item.pinned ? "is-pinned" : undefined}>
          <div>
            <p className="paper-meta">{item.category}</p>
            <h3>
              {item.pinned ? (
                <span className="paper-log__star" aria-label="Highlighted">
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
      ))}
    </div>
  );
}
