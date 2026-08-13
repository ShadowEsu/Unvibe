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

interface AnalyticsPayload {
  ok: true;
  stats: TrafficSummary;
  waitlist: WaitlistSummary;
  betaDownloads: number;
}

function compactDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
}

export function FounderAnalytics() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/stats?include=waitlist", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as AnalyticsPayload | { error?: string } | null;
      if (!response.ok || !payload || !("ok" in payload) || payload.ok !== true) {
        throw new Error(payload && "error" in payload ? payload.error || "Analytics are unavailable." : "Analytics are unavailable.");
      }
      setData(payload);
      setError(null);
      setUpdatedAt(new Date());
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
    ...(data?.waitlist.dailySignups ?? []).map((day) => day.signups),
  ), [data]);

  return (
    <section className="founder-analytics" aria-busy={loading}>
      <header className="founder-analytics__header">
        <div>
          <span className="founder-analytics__eyebrow">Founder analytics</span>
          <h1>Unvibe, by the numbers.</h1>
          <p>Public aggregates only. No names, emails, or code are shown here.</p>
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
          <strong>Couldn&apos;t load the numbers.</strong>
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
              <span>Waitlist</span>
              <strong>{data.waitlist.total.toLocaleString()}</strong>
              <small>{data.waitlist.attributed} campaign attributed</small>
            </article>
            <article>
              <span>Beta requests</span>
              <strong>{data.betaDownloads.toLocaleString()}</strong>
              <small>Download requests recorded</small>
            </article>
            <article>
              <span>Visitors today</span>
              <strong>{data.stats.today.visitors.toLocaleString()}</strong>
              <small>{data.stats.today.views.toLocaleString()} page views</small>
            </article>
            <article>
              <span>Last 7 days</span>
              <strong>{data.stats.week.visitors.toLocaleString()}</strong>
              <small>{data.stats.week.views.toLocaleString()} page views</small>
            </article>
            <article>
              <span>All-time visitors</span>
              <strong>{data.stats.allTime.visitors.toLocaleString()}</strong>
              <small>{data.stats.allTime.views.toLocaleString()} page views</small>
            </article>
            <article>
              <span>Referred signups</span>
              <strong>{data.waitlist.referred.toLocaleString()}</strong>
              <small>From referral codes</small>
            </article>
          </div>

          <div className="founder-analytics__panels">
            <article className="founder-analytics__activity">
              <header>
                <div>
                  <span>Traffic</span>
                  <h2>Last 14 days</h2>
                </div>
                <small>Pacific time</small>
              </header>
              <div className="founder-analytics__bars" aria-label="Fourteen day page-view activity">
                {[...data.stats.recentDays].reverse().map((day) => {
                  const signups = data.waitlist.dailySignups.find((item) => item.date === day.date)?.signups ?? 0;
                  return (
                    <div key={day.date} title={`${compactDate(day.date)}: ${day.views} views, ${day.visitors} visitors, ${signups} signups`}>
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

          <footer className="founder-analytics__footer">
            <span>Tracking repaired on Aug 13, 2026. Earlier Blob counters could not be recovered.</span>
            <span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
          </footer>
        </>
      ) : null}
    </section>
  );
}
