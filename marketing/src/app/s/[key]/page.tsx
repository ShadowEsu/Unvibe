import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPrivateStats, statsKeyMatches } from "@/lib/privateStats";
import { FounderAnalytics } from "@/components/FounderAnalytics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Unvibe numbers",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const n = (value: number | null | undefined) => (value == null ? "n/a" : value.toLocaleString("en-US"));

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "lime" | "sky" | "sun" | "lilac" }) {
  return (
    <div className="pstats__tile" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export default async function PrivateStatsPage({ params }: { params: { key: string } }) {
  if (!statsKeyMatches(params.key)) notFound();
  const s = await getPrivateStats();
  const days = s.site?.recentDays.slice(-14) ?? [];
  const peak = Math.max(1, ...days.map((d) => d.views));
  const updated = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="pstats">
      <header className="pstats__head">
        <p className="pstats__eyebrow">Private · only you have this link</p>
        <h1>Unvibe, <em>by the numbers.</em></h1>
        <p className="pstats__updated">Live as of {updated} Pacific. Refresh for new numbers.</p>
      </header>

      {s.errors.length ? <div className="pstats__warn" role="status">{s.errors.map((e) => <p key={e}>{e}</p>)}</div> : null}

      <section>
        <h2>Website</h2>
        <div className="pstats__grid">
          <Tile tone="lime" label="Visits today" value={n(s.site?.today.views)} note={`${n(s.site?.today.visitors)} people`} />
          <Tile label="Visits this week" value={n(s.site?.week.views)} note={`${n(s.site?.week.visitors)} people`} />
          <Tile label="Visits all time" value={n(s.site?.allTime.views)} note={`${n(s.site?.allTime.visitors)} people`} />
          <Tile tone="sky" label="Try it in browser" value={n(s.tryIt?.total)} note={`${n(s.tryIt?.today)} in the last 24h`} />
        </div>
        {days.length ? (
          <div className="pstats__chart" aria-label="Visits, last 14 days">
            {days.map((d) => (
              <div key={d.date} title={`${d.date}: ${d.views} visits, ${d.visitors} people`}>
                <i style={{ height: `${Math.max(4, (d.views / peak) * 100)}%` }} />
                <b>{d.views}</b>
                <span>{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h2>Downloads</h2>
        <div className="pstats__grid">
          <Tile tone="lilac" label="Installer downloads" value={n(s.releases?.total)} note="All versions, from GitHub" />
          <Tile label="Mac" value={n(s.releases?.mac)} />
          <Tile label="Windows" value={n(s.releases?.windows)} />
          <Tile label={s.releases?.latest ? `Latest (${s.releases.latest.tag})` : "Latest"} value={n(s.releases?.latest?.downloads)} />
        </div>
      </section>

      <section>
        <h2>Waitlist and people</h2>
        <div className="pstats__grid">
          <Tile tone="sun" label="On the waitlist" value={n(s.waitlist?.total)} note={`${n(s.waitlist?.week)} joined this week`} />
          <Tile label="Got the welcome email" value={n(s.waitlist?.emailed)} />
          <Tile label="Came from a friend" value={n(s.waitlist?.referred)} note={`${n(s.referrals?.claims)} referral months granted`} />
          <Tile label="Joined via app or download" value={n((s.waitlist?.fromApp ?? 0) + (s.waitlist?.fromDownload ?? 0))} note={`${n(s.waitlist?.fromApp)} app · ${n(s.waitlist?.fromDownload)} download`} />
        </div>
      </section>

      <section>
        <h2>App</h2>
        <div className="pstats__grid">
          <Tile tone="lime" label="App accounts" value={n(s.app?.accounts)} />
          <Tile label="On free Pro right now" value={n(s.app?.proGifted)} note={`${n(s.referrals?.feedbackMonths)} feedback months earned`} />
          <Tile label="Learning events logged" value={n(s.app?.explanations)} />
          <Tile label="Understanding checks" value={n(s.app?.checks)} />
        </div>
      </section>

      <section>
        <h2>Feedback</h2>
        <div className="pstats__grid">
          <Tile tone="lilac" label="Reviews" value={n(s.feedback?.count)} />
          <Tile label="Average stars" value={s.feedback?.average != null ? `${s.feedback.average.toFixed(1)} ★` : "n/a"} />
        </div>
        {s.feedback?.recent.length ? (
          <ul className="pstats__feedback">
            {s.feedback.recent.map((f) => (
              <li key={f.createdAt}>
                <span className="pstats__stars">{"★".repeat(f.rating)}<em>{"★".repeat(5 - f.rating)}</em></span>
                <p>{f.message || <i>No words, just stars.</i>}</p>
                <small>{f.source} · {new Date(f.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
              </li>
            ))}
          </ul>
        ) : <p className="pstats__empty">No feedback yet.</p>}
      </section>

      <section className="pstats__admin">
        <h2>Admin tools</h2>
        <p>Signup details and deleting entries still need your admin token.</p>
        <FounderAnalytics />
      </section>
    </main>
  );
}
