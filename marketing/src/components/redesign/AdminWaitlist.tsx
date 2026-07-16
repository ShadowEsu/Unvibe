"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { WaitlistAdminEntry } from "@/lib/waitlistStore";

type ViewState = "locked" | "loading" | "ready" | "unauthorized" | "error";

export function AdminWaitlist() {
  const [token, setToken] = useState("");
  const [entries, setEntries] = useState<WaitlistAdminEntry[]>([]);
  const [state, setState] = useState<ViewState>("locked");
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState("");
  const [retryError, setRetryError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const notified = useMemo(
    () => entries.filter((entry) => entry.notification?.status === "sent").length,
    [entries]
  );

  const load = useCallback(async (credential: string, background = false) => {
    if (!credential.trim()) return;
    if (background) setRefreshing(true);
    else setState("loading");
    try {
      const response = await fetch("/api/waitlist/admin", {
        headers: { Authorization: `Bearer ${credential.trim()}` },
        cache: "no-store",
      });
      if (response.status === 401) {
        window.sessionStorage.removeItem("unvibe_waitlist_admin");
        setState("unauthorized");
        return;
      }
      if (!response.ok) throw new Error("load failed");
      const data = (await response.json()) as { entries: WaitlistAdminEntry[]; generatedAt: string };
      setEntries(data.entries);
      setUpdatedAt(data.generatedAt);
      window.sessionStorage.setItem("unvibe_waitlist_admin", credential.trim());
      setState("ready");
    } catch {
      setState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("unvibe_waitlist_admin");
    if (saved) {
      setToken(saved);
      void load(saved);
    }
  }, [load]);

  const downloadCsv = () => {
    const escape = (value: string | undefined) => `"${(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["joined", "first_name", "last_name", "email", "tool", "experience", "message", "notification", "source"],
      ...entries.map((entry) => [
        entry.createdAt,
        entry.firstName,
        entry.lastName,
        entry.email,
        entry.tool,
        entry.experience,
        entry.message,
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
    try {
      const response = await fetch("/api/waitlist/admin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("retry failed");
      const data = (await response.json()) as { notification: { status: "sent" | "failed" } };
      await load(token, true);
      if (data.notification.status === "failed") {
        setRetryError("Email delivery is still unavailable. Check provider activation and try again.");
      }
    } catch {
      setRetryError("The notification retry could not be completed.");
    } finally {
      setRetrying("");
    }
  };

  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <Logo />
        <a href="/">Back to site</a>
      </div>

      {state !== "ready" ? (
        <section className="admin-login">
          <span className="admin-lock"><LockKeyhole /></span>
          <p className="pixel-label">PRIVATE FOUNDER VIEW</p>
          <h1>Open the waitlist.</h1>
          <p>Enter the admin access key. It stays in this browser tab only.</p>
          <label>
            Admin access key
            <input
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void load(token); }}
            />
          </label>
          {(state === "unauthorized" || state === "error") && (
            <p className="admin-error" role="alert">
              {state === "unauthorized" ? "That access key is not valid." : "The waitlist could not be loaded. Try again."}
            </p>
          )}
          <button type="button" onClick={() => void load(token)} disabled={state === "loading" || !token.trim()}>
            {state === "loading" ? <><Loader2 className="spin" size={17} />Loading</> : "Open waitlist"}
          </button>
        </section>
      ) : (
        <section className="admin-content">
          <div className="admin-heading">
            <div><p className="pixel-label">PRIVATE BETA</p><h1>Waitlist</h1><p>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : ""}</p></div>
            <div className="admin-actions">
              <button type="button" onClick={() => void load(token, true)} disabled={refreshing}>
                <RefreshCw className={refreshing ? "spin" : undefined} size={16} />{refreshing ? "Refreshing" : "Refresh"}
              </button>
              <button type="button" onClick={downloadCsv} disabled={entries.length === 0}><Download size={16} />Export CSV</button>
            </div>
          </div>
          <div className="admin-stats">
            <article><small>Total signups</small><strong>{entries.length}</strong></article>
            <article><small>Email notifications sent</small><strong>{notified}</strong></article>
            <article><small>Latest signup</small><strong>{entries[0] ? new Date(entries[0].createdAt).toLocaleDateString() : "—"}</strong></article>
          </div>
          {retryError && <p className="admin-error" role="alert">{retryError}</p>}
          {entries.length === 0 ? (
            <div className="admin-empty"><p>No signups yet.</p><span>The first completed waitlist form will appear here.</span></div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Joined</th><th>Person</th><th>Email</th><th>Details</th><th>Notification</th></tr></thead>
                <tbody>{entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td><strong>{[entry.firstName, entry.lastName].filter(Boolean).join(" ") || "Name unavailable"}</strong></td>
                    <td><a href={`mailto:${entry.email}`}>{entry.email}</a></td>
                    <td><span>{entry.tool || "Tool not provided"}</span><small>{entry.experience || entry.message || "No optional details"}</small></td>
                    <td><span className={entry.notification?.status === "sent" ? "status-sent" : entry.notification?.status === "failed" ? "status-failed" : "status-pending"}>{entry.notification?.status === "sent" ? `Sent · ${entry.notification.provider}` : entry.notification?.status === "failed" ? `Failed · ${entry.notification.provider}` : "Not recorded"}</span>{entry.notification?.status !== "sent" && <button type="button" className="admin-retry" onClick={() => void retryNotification(entry.email)} disabled={retrying === entry.email}>{retrying === entry.email ? <><Loader2 className="spin" size={12} />Retrying</> : "Retry email"}</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
