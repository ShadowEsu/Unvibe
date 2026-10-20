"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { founderHeaders, readFounderToken, saveFounderToken } from "@/lib/founderToken";
import { Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SiteStatsSummary } from "@/lib/siteStatsStore";
import type { WaitlistAdminEntry } from "@/lib/waitlistStore";

const PRIOR_PEOPLE = 300;
const missing = "n/a";

/** locked: no token in this session; denied: the server rejected the token; error: anything else failed. */
type ViewState = "loading" | "locked" | "denied" | "error" | "ready";

export function AdminWaitlist() {
  const [entries, setEntries] = useState<WaitlistAdminEntry[]>([]);
  const [siteStats, setSiteStats] = useState<SiteStatsSummary | null>(null);
  const [state, setState] = useState<ViewState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState("");
  const [deleting, setDeleting] = useState("");
  const [retryError, setRetryError] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const notified = useMemo(
    () => entries.filter((entry) => entry.notification?.status === "sent").length,
    [entries]
  );

  const load = useCallback(async (background = false) => {
    // Both admin endpoints require the WAITLIST_ADMIN_TOKEN bearer. Without one, ask for it
    // instead of sending requests the server can only answer with 401.
    if (!readFounderToken()) {
      setState("locked");
      return;
    }
    if (background) setRefreshing(true);
    else setState("loading");
    try {
      const statsRequest = fetch("/api/stats", { cache: "no-store" });
      const waitlistResponse = await fetch("/api/waitlist/admin", { cache: "no-store", headers: founderHeaders() });

      if (waitlistResponse.status === 401) {
        // Both endpoints share one check, so the fallback below would be rejected too.
        saveFounderToken("");
        setState("denied");
        return;
      }

      if (waitlistResponse.ok) {
        const data = (await waitlistResponse.json()) as {
          entries: WaitlistAdminEntry[];
          generatedAt: string;
        };
        setEntries(data.entries);
        setUpdatedAt(data.generatedAt);
      } else {
        // Same admin token, older founder shape.
        const founderResponse = await fetch("/api/founder/waitlist", { cache: "no-store", headers: founderHeaders() });
        if (!founderResponse.ok) {
          throw new Error(
            `The waitlist API answered ${waitlistResponse.status} and the founder API answered ${founderResponse.status}.`
          );
        }
        const roster = (await founderResponse.json()) as {
          entries?: Array<{ name: string; email: string; joinedAt: string; tool: string }>;
        };
        const mapped: WaitlistAdminEntry[] = (roster.entries ?? []).map((entry, index) => {
          const [firstName = "", ...rest] = entry.name.split(" ");
          return {
            id: `${entry.email}-${index}`,
            firstName,
            lastName: rest.join(" "),
            email: entry.email,
            tool: entry.tool,
            referralCode: "",
            createdAt: entry.joinedAt,
          };
        });
        setEntries(mapped);
        setUpdatedAt(new Date().toISOString());
      }

      const statsResponse = await statsRequest;
      if (statsResponse.ok) {
        const statsData = (await statsResponse.json()) as { stats?: SiteStatsSummary };
        setSiteStats(statsData.stats ?? null);
      } else {
        setSiteStats(null);
      }
      setLoadError("");
      setState("ready");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The request did not complete.");
      setState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadCsv = () => {
    const escape = (value: string | undefined) => `"${(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["joined", "first_name", "last_name", "email", "tool", "experience", "message", "promo_code", "referred_by", "notification", "source"],
      ...entries.map((entry) => [
        entry.createdAt,
        entry.firstName,
        entry.lastName,
        entry.email,
        entry.tool,
        entry.experience,
        entry.message,
        entry.promoCode,
        entry.referredBy,
        entry.notification?.status,
        entry.utmSource,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `unvibe-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const retryNotification = async (email: string) => {
    setRetrying(email);
    setRetryError("");
    setActionError("");
    try {
      const response = await fetch("/api/waitlist/admin", {
        method: "POST",
        headers: founderHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("retry failed");
      const data = (await response.json()) as { notification: { status: "sent" | "failed" } };
      await load(true);
      if (data.notification.status === "failed") {
        setRetryError("Email delivery is still unavailable. Check provider activation and try again.");
      }
    } catch {
      setRetryError("The notification retry could not be completed.");
    } finally {
      setRetrying("");
    }
  };

  const deleteEntry = async (email: string) => {
    const confirmed = window.confirm(`Remove ${email} from the waitlist?`);
    if (!confirmed) return;
    setDeleting(email);
    setActionError("");
    setRetryError("");
    try {
      const response = await fetch("/api/founder/waitlist", {
        method: "DELETE",
        headers: founderHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("delete failed");
      setEntries((current) => current.filter((entry) => entry.email !== email));
      await load(true);
    } catch {
      setActionError("That signup could not be deleted. Refresh and try again.");
    } finally {
      setDeleting("");
    }
  };

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <Logo />
        <a href="/">Back to site</a>
      </div>

      {state === "loading" ? (
        <section className="admin-login" role="status">
          <Loader2 className="spin" size={22} aria-hidden="true" />
          <p>Loading signups…</p>
        </section>
      ) : state === "ready" ? null : (
        <section className="admin-login">
          <h1>{state === "error" ? "Could not load the waitlist." : "Waitlist"}</h1>
          {state === "locked" ? (
            <p>This view is private. Enter the admin token (WAITLIST_ADMIN_TOKEN) to see signups.</p>
          ) : state === "denied" ? (
            <p className="admin-error" role="alert">That admin token was not accepted. Check WAITLIST_ADMIN_TOKEN and try again.</p>
          ) : (
            <p className="admin-error" role="alert">{loadError} Check storage on this deployment, then retry.</p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveFounderToken(tokenDraft.trim());
              setTokenDraft("");
              void load();
            }}
          >
            <label htmlFor="admin-token">Admin token</label>
            <input
              id="admin-token"
              type="password"
              autoComplete="off"
              required
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
            />
            <button type="submit">{state === "locked" ? "Unlock" : "Unlock and retry"}</button>
          </form>
        </section>
      )}
      {state === "ready" && (
        <section className="admin-content">
          <div className="admin-heading">
            <div>
              <p className="pixel-label">FOUNDER VIEW</p>
              <h1>Waitlist</h1>
              <p>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : ""}</p>
            </div>
            <div className="admin-actions">
              <button type="button" onClick={() => void load(true)} disabled={refreshing}>
                <RefreshCw className={refreshing ? "spin" : undefined} size={16} />
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
              <button type="button" onClick={downloadCsv} disabled={entries.length === 0}>
                <Download size={16} />Export CSV
              </button>
            </div>
          </div>

          <div className="admin-section-label">
            <p className="pixel-label">Site viewers</p>
            <span>Unique browsers only · Today resets at midnight PT</span>
          </div>
          <div className="admin-stats">
            <article>
              <small>Today</small>
              <strong>{siteStats?.today.visitors ?? missing}</strong>
              <span>{siteStats ? `${siteStats.today.views} page views · ${siteStats.today.date}` : "Unavailable"}</span>
            </article>
            <article>
              <small>This week</small>
              <strong>{siteStats?.week.visitors ?? missing}</strong>
              <span>{siteStats ? `${siteStats.week.views} page views · last 7 days PT` : "Unavailable"}</span>
            </article>
            <article>
              <small>All time</small>
              <strong>{siteStats ? (siteStats.allTime.visitors + PRIOR_PEOPLE).toLocaleString() : missing}</strong>
              <span>{siteStats ? `${siteStats.allTime.views} page views, including ${PRIOR_PEOPLE} people from before this counter` : "Unavailable"}</span>
            </article>
          </div>

          <div className="admin-section-label">
            <p className="pixel-label">Waitlist</p>
            <span>Signups collected from the public form</span>
          </div>
          <div className="admin-stats">
            <article><small>Total signups</small><strong>{entries.length}</strong></article>
            <article><small>Email notifications sent</small><strong>{notified}</strong></article>
            <article><small>Promo claims</small><strong>{entries.filter((entry) => entry.promoCode).length}</strong></article>
            <article><small>Latest signup</small><strong>{entries[0] ? new Date(entries[0].createdAt).toLocaleDateString() : missing}</strong></article>
          </div>
          {retryError && <p className="admin-error" role="alert">{retryError}</p>}
          {actionError && <p className="admin-error" role="alert">{actionError}</p>}
          {entries.length === 0 ? (
            <div className="admin-empty">
              <p>No signups yet.</p>
              <span>The first completed waitlist form will appear here.</span>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Joined</th>
                    <th>Person</th>
                    <th>Email</th>
                    <th>Details</th>
                    <th>Promo</th>
                    <th>Notification</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>
                        <strong>
                          {[entry.firstName, entry.lastName].filter(Boolean).join(" ") || "Name unavailable"}
                        </strong>
                      </td>
                      <td><a href={`mailto:${entry.email}`}>{entry.email}</a></td>
                      <td>
                        <span>{entry.tool || "Tool not provided"}</span>
                        <small>{entry.experience || entry.message || "No optional details"}</small>
                      </td>
                      <td>
                        {entry.promoCode ? <><strong>{entry.promoCode}</strong><small>{entry.referredBy ? `Referral recorded · ${entry.referredBy}` : "No verified referrer"}</small></> : <span>None</span>}
                      </td>
                      <td>
                        <span
                          className={
                            entry.notification?.status === "sent"
                              ? "status-sent"
                              : entry.notification?.status === "failed"
                                ? "status-failed"
                                : "status-pending"
                          }
                        >
                          {entry.notification?.status === "sent"
                            ? `Sent · ${entry.notification.provider}`
                            : entry.notification?.status === "failed"
                              ? `Failed · ${entry.notification.provider}`
                              : "Not recorded"}
                        </span>
                        {entry.notification?.status !== "sent" && (
                          <button
                            type="button"
                            className="admin-retry"
                            onClick={() => void retryNotification(entry.email)}
                            disabled={retrying === entry.email || deleting === entry.email}
                          >
                            {retrying === entry.email
                              ? <><Loader2 className="spin" size={12} />Retrying</>
                              : "Retry email"}
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-delete"
                          onClick={() => void deleteEntry(entry.email)}
                          disabled={deleting === entry.email || retrying === entry.email}
                        >
                          {deleting === entry.email
                            ? <><Loader2 className="spin" size={12} />Deleting</>
                            : <><Trash2 size={12} />Delete</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
