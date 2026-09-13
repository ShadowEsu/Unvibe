"use client";

import { FormEvent, useState } from "react";

export default function UnsubscribePage({ searchParams }: { searchParams: { t?: string } }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const token = searchParams.t ?? "";

  async function unsubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const response = await fetch("/api/outreach/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setStatus(response.ok ? "done" : "error");
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 24px", color: "inherit" }}>
      <p style={{ letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12 }}>Unvibe</p>
      <h1>Manage email preferences</h1>
      {status === "done" ? (
        <p>You will no longer receive outreach from Unvibe.</p>
      ) : (
        <form onSubmit={unsubscribe}>
          <p>Stop receiving occasional product outreach from Unvibe.</p>
          <button type="submit" disabled={!token || status === "loading"}>
            {status === "loading" ? "Removing…" : "Unsubscribe"}
          </button>
          {status === "error" ? <p role="alert">We could not process that request. Please reply “stop” to the email instead.</p> : null}
        </form>
      )}
    </main>
  );
}
