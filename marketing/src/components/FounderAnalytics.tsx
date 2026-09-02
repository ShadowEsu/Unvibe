"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

interface AnalyticsPayload {
  ok: true;
  stats: TrafficSummary;
  waitlist: WaitlistSummary;
  betaDownloads: number;
  installs?: InstallCounts;
}

interface WaitlistPerson {
  name: string;
  email: string;
  joinedAt: string;
  tool: string;
  experience: string;
  message: string;
  promoCode: string;
  referredBy: string;
  referralCode: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

const PRIOR_PEOPLE = 300;

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

  return (
    <section className="founder-analytics" aria-busy={loading}>
      <header className="founder-analytics__header">
        <div>
          <span className="founder-analytics__eyebrow">Founder analytics</span>
          <h1>Unvibe, by the numbers.</h1>
          <p>Page views count every load. Unique visitors count distinct browsers. Copy clicks, form clicks, and every waitlist field sit below.</p>
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
          <div className="founder-analytics__grid">
            <article>
              <span>Page views today</span>
              <strong>{data.stats.today.views.toLocaleString()}</strong>
              <small>Every homepage and marketing page load counted today, Pacific time</small>
            </article>
            <article>
              <span>Unique visitors today</span>
              <strong>{data.stats.today.visitors.toLocaleString()}</strong>
              <small>Distinct browsers today. Repeat refreshes from one person stay one visitor</small>
            </article>
            <article>
              <span>Page views, 7 days</span>
              <strong>{data.stats.week.views.toLocaleString()}</strong>
              <small>{data.stats.week.visitors.toLocaleString()} unique visitors this week</small>
            </article>
            <article>
              <span>Unique visitors, 7 days</span>
              <strong>{data.stats.week.visitors.toLocaleString()}</strong>
              <small>{data.stats.week.views.toLocaleString()} page views this week</small>
            </article>
            <article>
              <span>All-time page views</span>
              <strong>{data.stats.allTime.views.toLocaleString()}</strong>
              <small>Counted since tracking was repaired on Aug 13, 2026</small>
            </article>
            <article>
              <span>All-time unique visitors</span>
              <strong>{(data.stats.allTime.visitors + PRIOR_PEOPLE).toLocaleString()}</strong>
              <small>{data.stats.allTime.visitors.toLocaleString()} from this counter, plus {PRIOR_PEOPLE} people from before it</small>
            </article>
            <article>
              <span>Waitlist people</span>
              <strong>{data.waitlist.total.toLocaleString()}</strong>
              <small>{people.length.toLocaleString()} names in the table below</small>
            </article>
            <article>
              <span>Command copies</span>
              <strong>{(data.installs?.copied ?? 0).toLocaleString()}</strong>
              <small>{data.installs?.fetched ?? 0} curl or PowerShell fetches, {data.installs?.installed ?? 0} finished installs</small>
            </article>
            <article>
              <span>Form clicks</span>
              <strong>{(data.installs?.survey ?? 0).toLocaleString()}</strong>
              <small>Opens of unvibe.site/feedback from the site, email, or the app</small>
            </article>
            <article>
              <span>Referred signups</span>
              <strong>{data.waitlist.referred.toLocaleString()}</strong>
              <small>{data.betaDownloads.toLocaleString()} beta download requests</small>
            </article>
          </div>

          <div className="founder-analytics__panels">
            <article className="founder-analytics__activity">
              <header>
                <div>
                  <span>Page views</span>
                  <h2>Last 14 days</h2>
                </div>
                <small>Pacific time. Bar height is page views, not unique visitors.</small>
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
                <span>Waitlist sources</span>
                <h2>Where people found Unvibe</h2>
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

          <article className="founder-analytics__visits">
            <header>
              <span>Daily visits</span>
              <h2>Page views versus unique visitors</h2>
            </header>
            <div className="founder-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Page views</th>
                    <th>Unique visitors</th>
                    <th>Waitlist joins</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.recentDays.map((day) => (
                    <tr key={day.date}>
                      <td>{compactDate(day.date)}</td>
                      <td>{day.views.toLocaleString()}</td>
                      <td>{day.visitors.toLocaleString()}</td>
                      <td>{(data.waitlist.dailySignups.find((item) => item.date === day.date)?.signups ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="founder-analytics__people">
            <header>
              <span>Waitlist</span>
              <h2>Everyone who joined</h2>
            </header>
            {peopleError ? <p className="founder-analytics__empty">{peopleError}</p> : null}
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
                      <th>Experience</th>
                      <th>Message</th>
                      <th>Promo</th>
                      <th>Referred by</th>
                      <th>Referral code</th>
                      <th>UTM source</th>
                      <th>UTM medium</th>
                      <th>UTM campaign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => (
                      <tr key={`${person.email}-${person.joinedAt}`}>
                        <td>{person.name}</td>
                        <td><a href={`mailto:${person.email}`}>{person.email}</a></td>
                        <td>{joinedStamp(person.joinedAt)}</td>
                        <td>{person.tool}</td>
                        <td>{person.experience ?? "Not given"}</td>
                        <td>{person.message ?? "Not given"}</td>
                        <td>{person.promoCode ?? "None"}</td>
                        <td>{person.referredBy ?? "None"}</td>
                        <td>{person.referralCode ?? "None"}</td>
                        <td>{person.utmSource ?? "None"}</td>
                        <td>{person.utmMedium ?? "None"}</td>
                        <td>{person.utmCampaign ?? "None"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>

          <footer className="founder-analytics__footer">
            <span>Tracking repaired on Aug 13, 2026. Earlier Blob counters could not be recovered.</span>
            <span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
          </footer>
        </>
      ) : null}
    </section>
  );
}
