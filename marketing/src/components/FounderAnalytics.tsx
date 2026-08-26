"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { isProbeWaitlistEmail } from "@/lib/waitlistProbes";

const PRIOR_PEOPLE = 300;

interface TrafficSummary {
  today: { views: number; visitors: number; date: string };
  week: { views: number; visitors: number };
  allTime: { views: number; visitors: number };
  recentDays: Array<{ date: string; views: number; visitors: number }>;
  timezone: "America/Los_Angeles";
}
interface WaitlistSummary {
  total: number;
  attributed: number;
  referred: number;
  sourceCounts: Array<{ source: string; signups: number }>;
  dailySignups: Array<{ date: string; signups: number }>;
}

interface InstallCounts {
  copied: number;
  fetched: number;
  installed: number;
  survey?: number;
}

interface GrowthFunnel {
  formStartedPeople: number;
  formStartedEvents: number;
  startedDidNotFinish: number;
  installViewedPeople: number;
  installCopiedPeople: number;
  surveyOpenedPeople: number;
  source: "posthog" | "floor";
}

interface AnalyticsPayload {
  ok: true;
  stats: TrafficSummary;
  waitlist: WaitlistSummary;
  betaDownloads: number;
  installs?: InstallCounts;
  funnel?: GrowthFunnel;
}

interface WaitlistPerson {
  name: string;
  email: string;
  joinedAt: string;
  tool: string;
}

function compactDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
}

function joinedStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function FounderAnalytics() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [people, setPeople] = useState<WaitlistPerson[]>([]);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [deleting, setDeleting] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clearingProbes, setClearingProbes] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsResponse, waitlistResponse] = await Promise.all([
        fetch("/api/stats?include=waitlist", { cache: "no-store" }),
        fetch("/api/founder/waitlist", { cache: "no-store" }),
      ]);
      const payload = await statsResponse.json().catch(() => null) as AnalyticsPayload | { error?: string } | null;
      if (!statsResponse.ok || !payload || !("ok" in payload) || payload.ok !== true) {
        throw new Error(payload && "error" in payload ? payload.error || "Analytics are unavailable." : "Analytics are unavailable.");
      }
      setData(payload);
      setError(null);
      setUpdatedAt(new Date());

      const roster = await waitlistResponse.json().catch(() => null) as { ok?: true; entries?: WaitlistPerson[]; error?: string } | null;
      if (!waitlistResponse.ok || !roster?.ok || !roster.entries) {
        setPeople([]);
        setPeopleError(roster && "error" in roster ? roster.error || "Waitlist names could not load." : "Waitlist names could not load.");
      } else {
        setPeople(roster.entries);
        setPeopleError(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analytics are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const chartMax = useMemo(() => Math.max(
    1,
    ...(data?.stats.recentDays ?? []).map((day) => day.views),
  ), [data]);

  const probeCount = useMemo(
    () => people.filter((person) => isProbeWaitlistEmail(person.email, person.name)).length,
    [people],
  );

  const deletePerson = async (email: string) => {
    const confirmed = window.confirm(`Remove ${email} from the waitlist? Use this for test signups.`);
    if (!confirmed) return;
    setDeleting(email);
    setDeleteError(null);
    try {
      const response = await fetch("/api/founder/waitlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("delete failed");
      setPeople((current) => current.filter((person) => person.email !== email));
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          waitlist: {
            ...current.waitlist,
            total: Math.max(0, current.waitlist.total - 1),
          },
        };
      });
    } catch {
      setDeleteError("That signup could not be deleted. Refresh and try again.");
    } finally {
      setDeleting("");
    }
  };

  const clearProbes = async () => {
    const probes = people.filter((person) => isProbeWaitlistEmail(person.email, person.name));
    if (probes.length === 0) return;
    const confirmed = window.confirm(`Delete ${probes.length} probe/test waitlist signups? Real emails stay.`);
    if (!confirmed) return;
    setClearingProbes(true);
    setDeleteError(null);
    try {
      for (const person of probes) {
        const response = await fetch("/api/founder/waitlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: person.email }),
        });
        if (!response.ok) throw new Error("delete failed");
      }
      await load();
    } catch {
      setDeleteError("Could not clear every probe. Refresh and delete remaining rows with the trash button.");
    } finally {
      setClearingProbes(false);
    }
  };

  return (
    <section className="founder-analytics" aria-busy={loading}>
      <header className="founder-analytics__header">
        <div>
          <span className="founder-analytics__eyebrow">Founder analytics</span>
          <h1>Unvibe, by the numbers.</h1>
          <p>Joined people stay on the roster. Form starts, copies, and drop-off come from PostHog so unfinished traffic is not invented as accounts.</p>
        </div>
        <div className="founder-analytics__actions">
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <Link href="/build">Build record</Link>
        </div>
      </header>

      {error ? (
        <div className="founder-analytics__error" role="alert">
          <strong>Could not load the numbers.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>Try again</button>
        </div>
      ) : null}

      {!data && loading ? (
        <div className="founder-analytics__loading" aria-label="Loading analytics">
          <span /><span /><span /><span />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="founder-analytics__grid founder-analytics__grid--tight">
            <article>
              <span>Waitlist joined</span>
              <strong>{data.waitlist.total.toLocaleString()}</strong>
              <small>{data.waitlist.referred.toLocaleString()} referred · {people.length.toLocaleString()} real emails below</small>
            </article>
            <article>
              <span>Started the form</span>
              <strong>{(data.funnel?.formStartedPeople ?? 0).toLocaleString()}</strong>
              <small>{data.funnel?.formStartedEvents ?? 0} start events · PostHog unique people</small>
            </article>
            <article>
              <span>Started, did not finish</span>
              <strong>{(data.funnel?.startedDidNotFinish ?? 0).toLocaleString()}</strong>
              <small>People who opened the form and never joined</small>
            </article>
            <article>
              <span>Visitors today</span>
              <strong>{data.stats.today.visitors.toLocaleString()}</strong>
              <small>{data.stats.today.views.toLocaleString()} page views today, Pacific time</small>
            </article>
            <article>
              <span>Visitors, 7 days</span>
              <strong>{data.stats.week.visitors.toLocaleString()}</strong>
              <small>{data.stats.week.views.toLocaleString()} page views this week</small>
            </article>
            <article>
              <span>Install copies</span>
              <strong>{Math.max(data.funnel?.installCopiedPeople ?? 0, data.installs?.copied ?? 0).toLocaleString()}</strong>
              <small>{data.funnel?.installViewedPeople ?? 0} saw the command · {data.installs?.fetched ?? 0} fetches · {data.installs?.installed ?? 0} finished</small>
            </article>
            <article>
              <span>Feedback clicks</span>
              <strong>{Math.max(data.funnel?.surveyOpenedPeople ?? 0, data.installs?.survey ?? 0).toLocaleString()}</strong>
              <small>Opens of /feedback from site, email, or app</small>
            </article>
            <article>
              <span>All-time visitors</span>
              <strong>{(data.stats.allTime.visitors + PRIOR_PEOPLE).toLocaleString()}</strong>
              <small>{data.stats.allTime.views.toLocaleString()} page views since Aug 13, 2026</small>
            </article>
          </div>

          <div className="founder-analytics__panels">
            <article className="founder-analytics__activity">
              <header>
                <div>
                  <span>Page views</span>
                  <h2>Last 14 days</h2>
                </div>
                <small>Pacific time</small>
              </header>
              <div className="founder-analytics__bars" aria-label="Fourteen day page views">
                {[...data.stats.recentDays].reverse().map((day) => {
                  const signups = data.waitlist.dailySignups.find((item) => item.date === day.date)?.signups ?? 0;
                  return (
                    <div key={day.date} title={`${compactDate(day.date)}: ${day.views} page views, ${day.visitors} unique visitors, ${signups} waitlist joins`}>
                      <span className="founder-analytics__bar-value">{day.views || ""}</span>
                      <span className="founder-analytics__bar-track">
                        <span style={{ height: `${Math.max(day.views ? 10 : 2, (day.views / chartMax) * 100)}%` }} />
                      </span>
                      <small>{compactDate(day.date)}</small>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="founder-analytics__sources">
              <header>
                <span>Sources</span>
                <h2>Where joins came from</h2>
              </header>
              <ol>
                {data.waitlist.sourceCounts.length ? data.waitlist.sourceCounts.map((source) => (
                  <li key={source.source}>
                    <span>{source.source.replaceAll("_", " ")}</span>
                    <strong>{source.signups}</strong>
                  </li>
                )) : <li><span>No signups recorded yet</span><strong>0</strong></li>}
              </ol>
            </article>
          </div>

          <article className="founder-analytics__people">
            <header>
              <div>
                <span>Waitlist</span>
                <h2>Joined people only</h2>
              </div>
              {probeCount > 0 ? (
                <button
                  type="button"
                  className="founder-analytics__clear-probes"
                  onClick={() => void clearProbes()}
                  disabled={clearingProbes || Boolean(deleting)}
                >
                  {clearingProbes ? "Clearing…" : `Clear ${probeCount} probes`}
                </button>
              ) : null}
            </header>
            {peopleError ? <p className="founder-analytics__empty">{peopleError}</p> : null}
            {deleteError ? <p className="founder-analytics__empty" role="alert">{deleteError}</p> : null}
            {!peopleError && people.length === 0 ? (
              <p className="founder-analytics__empty">No waitlist names yet. The first signup will appear here.</p>
            ) : null}
            {people.length > 0 ? (
              <div className="founder-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Joined</th>
                      <th>Tool</th>
                      <th aria-label="Delete" />
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => (
                      <tr key={`${person.email}-${person.joinedAt}`} className={isProbeWaitlistEmail(person.email, person.name) ? "is-probe" : undefined}>
                        <td>{person.name}</td>
                        <td><a href={`mailto:${person.email}`}>{person.email}</a></td>
                        <td>{joinedStamp(person.joinedAt)}</td>
                        <td>{person.tool}</td>
                        <td className="founder-analytics__trash-cell">
                          <button
                            type="button"
                            className="founder-analytics__trash"
                            onClick={() => void deletePerson(person.email)}
                            disabled={deleting === person.email || clearingProbes}
                            aria-label={`Delete ${person.email}`}
                            title="Delete signup"
                          >
                            {deleting === person.email ? "…" : <Trash2 size={16} aria-hidden="true" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>

          <footer className="founder-analytics__footer">
            <span>Funnel from PostHog. Joined count excludes probes and the install sentinel. Floor seeded from the Aug 26 audit if PostHog query is unavailable.</span>
            <span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
          </footer>
        </>
      ) : null}
    </section>
  );
}
