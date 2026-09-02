"use client";

import { useEffect, useState } from "react";
import { useCopyToast } from "@/components/paper/CopyToast";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import {
  BETA_FEEDBACK_URL,
  BETA_INSTALL_COMMAND,
  BETA_INSTALL_LABEL,
  BETA_INSTALL_VERSION,
  BETA_WINDOWS_INSTALL_COMMAND,
} from "@/lib/betaOffer";

interface BetaInstallProps {
  tone?: "hero" | "page";
  showFeedback?: boolean;
  title?: string;
}

type InstallOs = "mac" | "windows";

function detectInstallOs(): InstallOs {
  if (typeof navigator === "undefined") return "mac";
  return /Windows/i.test(navigator.userAgent) ? "windows" : "mac";
}

export function BetaInstall({
  tone = "hero",
  showFeedback = true,
  title = BETA_INSTALL_LABEL,
}: BetaInstallProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [os, setOs] = useState<InstallOs>("mac");
  const { showCopyToast } = useCopyToast();
  const command = os === "windows" ? BETA_WINDOWS_INSTALL_COMMAND : BETA_INSTALL_COMMAND;
  const prompt = os === "windows" ? "PS>" : "$";

  useEffect(() => {
    const detected = detectInstallOs();
    setOs(detected);
    track("beta_install_viewed", { surface: tone, os: detected });
    const selectFromCta = (event: Event) => {
      const platform = (event as CustomEvent<InstallOs>).detail;
      if (platform === "mac" || platform === "windows") setOs(platform);
    };
    window.addEventListener("unvibe:install-platform", selectFromCta);
    return () => window.removeEventListener("unvibe:install-platform", selectFromCta);
  }, [tone]);

  const selectOs = (next: InstallOs) => {
    setOs(next);
    track("beta_install_os_selected", { os: next, surface: tone });
  };

  const copyCommand = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      showCopyToast(os === "windows" ? "Copied the Windows install command" : "Copied the Mac install command");
      track("beta_install_copied", { os, surface: tone });
      recordBetaSiteEvent("copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed. Select the command and copy it yourself.");
    }
  };

  return (
    <div className={tone === "hero" ? "paper-beta paper-beta--hero" : "paper-beta paper-beta--page"}>
      <p className="paper-beta__title">{title}</p>
      <p className="paper-beta__version">{BETA_INSTALL_VERSION}</p>
      {tone === "page" ? (
        <p className="paper-beta__blurb">
          {os === "windows"
            ? "Windows x64. 30 AI explanations, then it stops. No API key."
            : "Apple silicon. 30 AI explanations, then it stops. No API key."}
        </p>
      ) : null}
      <div className="paper-beta__os" role="tablist" aria-label="Install platform">
        <button
          type="button"
          role="tab"
          aria-selected={os === "mac"}
          className={os === "mac" ? "is-on" : undefined}
          onClick={() => selectOs("mac")}
        >
          Mac
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={os === "windows"}
          className={os === "windows" ? "is-on" : undefined}
          onClick={() => selectOs("windows")}
        >
          Windows
        </button>
      </div>
      <div className="paper-beta__term">
        <pre
          role="button"
          tabIndex={0}
          aria-label={`Copy ${os === "windows" ? "Windows" : "Mac"} install command`}
          onClick={() => void copyCommand()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void copyCommand();
            }
          }}
        >
          <code>
            <span className="paper-beta__cmd">
              <span className="paper-beta__prompt">{prompt}</span>
              {command}
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
          <p className="paper-beta__offer">Install, open Unvibe, then select code and press the shortcut. After 30 explanations, the feedback form unlocks 1 week of Pro.</p>
          <a
            className="paper-beta__survey"
            href={BETA_FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              track("survey_opened", { source: tone === "hero" ? "hero_install" : "page_install", os });
              track("feedback_opened", { source: tone === "hero" ? "hero_install" : "page_install", os });
              recordBetaSiteEvent("survey");
            }}
          >
            {BETA_FEEDBACK_URL}
          </a>
        </>
      ) : null}
    </div>
  );
}

export function BetaFeedback({ source }: { source: string }) {
  return (
    <div className="paper-beta-feedback">
      <p className="paper-beta__offer">After you try the beta, finish this form for 1 week of Pro. Waitlist gifts still add on.</p>
      <a
        className="paper-beta__survey"
        href={BETA_FEEDBACK_URL}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          track("survey_opened", { source });
          track("feedback_opened", { source });
          recordBetaSiteEvent("survey");
        }}
      >
        {BETA_FEEDBACK_URL}
      </a>
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
