"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Gift, Loader2 } from "lucide-react";

type Progress = { joinedReferrals: number; proMonths: number; rewardCap: number };

export function ReferralProgress({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.slice(0, 8));
  const [progress, setProgress] = useState<Progress | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">(initialCode ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const loadedInitial = useRef(false);

  const load = useCallback(async (nextCode = code) => {
    const normalized = nextCode.trim().toLowerCase();
    if (!/^[a-f0-9]{8}$/.test(normalized)) {
      setProgress(null); setState("error"); setMessage("Enter the 8-character code from your referral link."); return;
    }
    setState("loading"); setMessage("");
    try {
      const response = await fetch(`/api/referrals/${normalized}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as Progress & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load progress.");
      setProgress(data); setState("idle");
    } catch (error) {
      setProgress(null); setState("error"); setMessage(error instanceof Error ? error.message : "Could not load progress.");
    }
  }, [code]);

  useEffect(() => {
    if (!initialCode || loadedInitial.current) return;
    loadedInitial.current = true;
    void load(initialCode);
  }, [initialCode, load]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?ref=${code.trim().toLowerCase()}`);
      setCopied(true); window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Couldn't copy your link. Copy it from your browser's address bar instead."); setState("error");
    }
  };

  const months = progress ? Math.min(progress.proMonths, progress.rewardCap) : 0;
  const left = progress ? Math.max(0, progress.rewardCap - months) : 5;
  return <main className="reward-page"><section className="reward-panel">
    <p className="pixel-label">UNVIBE / PRIVATE BETA</p>
    <h1>Your Pro months, <em>kept simple.</em></h1>
    <p className="reward-lead">Every friend who joins with your link gets you both a month of Pro, up to five friends. Months stack and land on the app account with the same email.</p>
    <form className="reward-code" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <label htmlFor="referral-code">Your referral code</label>
      <div><input id="referral-code" value={code} maxLength={8} autoCapitalize="none" spellCheck={false} onChange={(event) => setCode(event.target.value)} placeholder="8 characters" /><button type="submit" disabled={state === "loading"}>{state === "loading" ? <Loader2 className="spin" size={17} /> : "Check progress"}</button></div>
    </form>
    {state === "error" && <p className="reward-error" role="alert">{message}</p>}
    {progress && <div className="reward-progress" aria-live="polite">
      <div className="reward-stat"><span>Pro months earned</span><strong>{months}</strong><small>{left > 0 ? `${left} more friend${left === 1 ? "" : "s"} can still get you one` : "You hit the max. Thank you!"}</small></div>
      <div className="reward-track" aria-label={`${months} of ${progress.rewardCap} Pro months earned`}>{Array.from({ length: progress.rewardCap }, (_, i) => <i key={i} className={i < months ? "on" : ""} />)}</div>
      <div className="reward-review"><Gift size={18} /><span><strong>{progress.joinedReferrals} friend{progress.joinedReferrals === 1 ? "" : "s"} joined with your link</strong><small>A friend counts once, and only if they were new to Unvibe.</small></span></div>
      <button className="reward-copy" type="button" onClick={copyLink}>{copied ? <><Check size={16} /> Link copied</> : <><Copy size={16} /> Copy my referral link</>}</button>
    </div>}
    <p className="reward-note">No names or emails are shown here. Questions about eligibility? <a href="mailto:support@unvibe.site?subject=Unvibe%20referral%20rewards">Contact support</a>.</p>
  </section></main>;
}
