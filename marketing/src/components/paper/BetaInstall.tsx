"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { BETA_INSTALL_COMMAND, BETA_INSTALL_VERSION, BETA_SURVEY_URL } from "@/lib/betaOffer";

interface BetaInstallProps {
  tone?: "hero" | "page";
  showFeedback?: boolean;
}

export function BetaInstall({ tone = "hero", showFeedback = true }: BetaInstallProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const copyCommand = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(BETA_INSTALL_COMMAND);
      setCopied(true);
      track("beta_install_copied");
      void fetch("/api/install/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "copied" }),
        keepalive: true,
      }).catch(() => undefined);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed. Select the command and copy it yourself.");
    }
  };

  return (
    <div className={tone === "hero" ? "paper-beta paper-beta--hero" : "paper-beta paper-beta--page"}>
      <p className="paper-beta__title">Beta App (30 Explanations)</p>
      <p className="paper-beta__version">{BETA_INSTALL_VERSION}.30</p>
      <div className="paper-beta__term">
        <pre>
          <code>
            <span className="paper-beta__cmd">
              <span className="paper-beta__prompt">$</span>
              {BETA_INSTALL_COMMAND}
            </span>
          </code>
        </pre>
        <button
          type="button"
          className={copied ? "is-copied" : undefined}
          onClick={() => void copyCommand()}
          aria-label={copied ? "Copied" : "Copy command"}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      {error ? <p className="paper-beta__error" role="alert">{error}</p> : null}
      {showFeedback ? (
        <>
          <p className="paper-beta__offer">Finish feedback for free subscription offer</p>
          <a
            className="paper-beta__survey"
            href={BETA_SURVEY_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("survey_opened", { source: tone === "hero" ? "hero_install" : "page_install" })}
          >
            {BETA_SURVEY_URL}
          </a>
        </>
      ) : null}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
