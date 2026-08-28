"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Gift, Loader2 } from "lucide-react";

type Progress = { joinedReferrals: number; nextRewardAt: number; rewardsPendingReview: number; rewardCap: number };

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

  const filled = progress ? progress.joinedReferrals % 3 : 0;
  const toNext = progress ? (filled === 0 ? 3 : 3 - filled) : 3;
  return <main className="reward-page"><section className="reward-panel">
    <p className="pixel-label">UNVIBE / PRIVATE BETA</p>
    <h1>Referral progress, <em>kept simple.</em></h1>
    <p className="reward-lead">Every 3 joined referrals unlocks a $5 reward for review. You can reach up to 5 rewards ($25 total).</p>
    <form className="reward-code" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <label htmlFor="referral-code">Your referral code</label>
      <div><input id="referral-code" value={code} maxLength={8} autoCapitalize="none" spellCheck={false} onChange={(event) => setCode(event.target.value)} placeholder="8 characters" /><button type="submit" disabled={state === "loading"}>{state === "loading" ? <Loader2 className="spin" size={17} /> : "Check progress"}</button></div>
    </form>
    {state === "error" && <p className="reward-error" role="alert">{message}</p>}
    {progress && <div className="reward-progress" aria-live="polite">
      <div className="reward-stat"><span>Joined referrals</span><strong>{progress.joinedReferrals}</strong><small>{toNext} more to the next $5 milestone</small></div>
      <div className="reward-track" aria-label={`${filled} of 3 referrals toward the next reward`}><i className={filled >= 1 ? "on" : ""} /><i className={filled >= 2 ? "on" : ""} /><i className={filled >= 3 ? "on" : ""} /></div>
      <div className="reward-review"><Gift size={18} /><span><strong>{progress.rewardsPendingReview} reward milestone{progress.rewardsPendingReview === 1 ? "" : "s"} pending review</strong><small>Rewards are confirmed only after referral eligibility is checked.</small></span></div>
      <button className="reward-copy" type="button" onClick={copyLink}>{copied ? <><Check size={16} /> Link copied</> : <><Copy size={16} /> Copy my referral link</>}</button>
    </div>}
    <p className="reward-note">No names or emails are shown here. Questions about eligibility? <a href="mailto:support@unvibe.site?subject=Unvibe%20referral%20rewards">Contact support</a>.</p>
  </section></main>;
}
