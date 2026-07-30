"use client";

import { useState, type FormEvent } from "react";
import { Download, Mail } from "lucide-react";

export function BetaDownloadAccess() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ downloadUrl: string; emailNotice: string; referralCode: string } | null>(null);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/beta-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, email }),
      });
      const body = await response.json() as { error?: string; downloadUrl?: string; emailNotice?: string; referralCode?: string };
      if (!response.ok || !body.downloadUrl || !body.referralCode) throw new Error(body.error || "Could not prepare the download.");
      setResult({ downloadUrl: body.downloadUrl, emailNotice: body.emailNotice || "Your download is ready.", referralCode: body.referralCode });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not prepare the download.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <section className="beta-access-result" aria-live="polite">
        <Mail size={20} />
        <div><strong>{result.emailNotice}</strong><p>Referral code: <b>{result.referralCode}</b></p></div>
        <a href={result.downloadUrl}><Download size={18} /> Download Unvibe for macOS</a>
      </section>
    );
  }

  return (
    <form className="beta-access-form" onSubmit={submit}>
      <div><label htmlFor="beta-first-name">First name</label><input id="beta-first-name" name="firstName" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></div>
      <div><label htmlFor="beta-email">Email</label><input id="beta-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
      <button type="submit" disabled={busy}><Download size={18} />{busy ? "Preparing…" : "Get the macOS beta"}</button>
      <p>We email the download, feedback survey, and your personal referral code. No marketing spam.</p>
      {error && <p className="beta-access-error" role="alert">{error}</p>}
    </form>
  );
}
