"use client";

import { delight } from "@/lib/delight";

import { useEffect, useState } from "react";
import { useCopyToast } from "@/components/paper/CopyToast";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import {
  BETA_FEEDBACK_URL,
  BETA_INSTALL_COMMAND,
  BETA_INSTALL_LABEL,
  BETA_INSTALL_VERSION,
  BETA_MAC_DIRECT_DOWNLOAD,
  BETA_MAC_INTEL_DIRECT_DOWNLOAD,
  BETA_WINDOWS_DIRECT_DOWNLOAD,
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
  const [termOpen, setTermOpen] = useState(false);
  // Chromium browsers can tell an Intel Mac apart; Safari cannot, so Intel users also get a link.
  const [intelMac, setIntelMac] = useState(false);
  const { showCopyToast } = useCopyToast();
  const command = os === "windows" ? BETA_WINDOWS_INSTALL_COMMAND : BETA_INSTALL_COMMAND;
  const prompt = os === "windows" ? "PS>" : "$";
  const shellHint =
    os === "windows"
      ? "Paste in Windows PowerShell or Terminal (PowerShell). Not Command Prompt. Not Git Bash."
      : "Paste in Terminal on any Mac. It picks the right build for Apple silicon or Intel.";
  const directHref = os === "windows" ? BETA_WINDOWS_DIRECT_DOWNLOAD : intelMac ? BETA_MAC_INTEL_DIRECT_DOWNLOAD : BETA_MAC_DIRECT_DOWNLOAD;

  useEffect(() => {
    const detected = detectInstallOs();
    setOs(detected);
    const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; platform?: string }> } }).userAgentData;
    void uaData?.getHighEntropyValues?.(["architecture", "platform"]).then((v) => {
      if (v.platform === "macOS" && v.architecture === "x86") setIntelMac(true);
    }).catch(() => undefined);
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

      {/* OS selector tabs */}
      <div className="paper-beta__os" role="tablist" aria-label="Install platform">
        <button
          type="button"
          role="tab"
          aria-selected={os === "mac"}
          className={os === "mac" ? "is-on" : undefined}
          onClick={() => selectOs("mac")}
        >
          <span className="paper-beta__os-icon"><AppleIcon /></span>
          <span className="paper-beta__os-name">Mac</span>
          <span className="paper-beta__os-meta">{intelMac ? "Intel" : "M1 or newer"}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={os === "windows"}
          className={os === "windows" ? "is-on" : undefined}
          onClick={() => selectOs("windows")}
        >
          <span className="paper-beta__os-icon"><WindowsIcon /></span>
          <span className="paper-beta__os-name">Windows</span>
          <span className="paper-beta__os-meta">x64 PowerShell</span>
        </button>
      </div>

      {/* Primary download button */}
      <a
        className="paper-beta__download-btn"
        href={directHref}
        rel="noreferrer"
        onClick={() => {
          track("release_download_clicked", { os, surface: tone });
          delight();
          window.dispatchEvent(new Event("unvibe:downloaded"));
        }}
      >
        <DownloadIcon />
        <span>{os === "windows" ? "Download free for Windows" : "Download free for Mac"}</span>
      </a>
      {os === "mac" ? (
        <p className="paper-beta__update">
          {intelMac
            ? <>Downloading the Intel build. <a href={BETA_MAC_DIRECT_DOWNLOAD}>M1 or newer instead</a></>
            : <>Older Intel Mac? <a href={BETA_MAC_INTEL_DIRECT_DOWNLOAD}>Download the Intel build</a></>}
        </p>
      ) : null}
      <p className="paper-beta__update">
        <b>Already have Unvibe?</b>{" "}
        {os === "windows"
          ? "Quit it from the tray icon first, then run the new installer."
          : "Quit it from the menu bar first (Unvibe icon, Quit), then drag the new one into Applications and choose Replace."}
        {" "}From v0.1.30 on, Unvibe updates itself with one click.
      </p>
      {os === "mac" ? (
        <p className="paper-beta__update">
          <b>First open on a Mac:</b> right click Unvibe in Applications and choose Open. If macOS still blocks it,
          go to System Settings, Privacy &amp; Security, and press Open Anyway. Or skip all of that with the one line
          Terminal install below.
        </p>
      ) : (
        <p className="paper-beta__update">
          <b>First open on Windows:</b> if SmartScreen appears, press More info, then Run anyway.
        </p>
      )}

      {/* Spec pills */}
      <div className="paper-beta__specs" aria-label="System requirements">
        <span>{BETA_INSTALL_VERSION}</span>
        <span aria-hidden="true">·</span>
        <span>{os === "windows" ? "Windows 10+ x64" : "Apple silicon Mac"}</span>
        <span aria-hidden="true">·</span>
        <span>{os === "windows" ? "~81 MB .exe" : "~112 MB .dmg"}</span>
        <span aria-hidden="true">·</span>
        <span>No API key</span>
      </div>

      {/* Collapsible terminal install */}
      <button
        type="button"
        className="paper-beta__term-toggle"
        onClick={() => setTermOpen(!termOpen)}
        aria-expanded={termOpen}
      >
        <TerminalIcon />
        <span>Or install via Terminal</span>
        <ChevronIcon open={termOpen} />
      </button>

      {termOpen && (
        <div className="paper-beta__term-drawer">
          <p className="paper-beta__shell" role="note">{shellHint}</p>
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
        </div>
      )}

      {/* Value proposition line */}
      <p className="paper-beta__blurb">
        {os === "windows"
          ? "30 free AI explanations included. No credit card required."
          : "30 free AI explanations included. No credit card required."}
      </p>

      {/* 3-step quickstart */}
      <div className="paper-beta__quickstart">
        <div className="paper-beta__step">
          <span className="paper-beta__step-num">1</span>
          <span className="paper-beta__step-text">Download &amp; open</span>
        </div>
        <span className="paper-beta__step-arrow" aria-hidden="true">→</span>
        <div className="paper-beta__step">
          <span className="paper-beta__step-num">2</span>
          <span className="paper-beta__step-text">Select code in your editor</span>
        </div>
        <span className="paper-beta__step-arrow" aria-hidden="true">→</span>
        <div className="paper-beta__step">
          <span className="paper-beta__step-num">3</span>
          <span className="paper-beta__step-text">Press {os === "windows" ? "Ctrl+U" : "⌘U"}</span>
        </div>
      </div>

      {showFeedback ? (
        <>
          <p className="paper-beta__offer">
            After 30 explanations, fill the feedback form to unlock 1 week of Pro.
          </p>
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
      <p className="paper-beta__offer">After you try the beta, submit your feedback for 1 free week of Pro.</p>
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

/* ── Inline SVG icons ── */

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.35 12.55c-.03-2.28 1.86-3.37 1.94-3.42-1.06-1.55-2.7-1.76-3.28-1.78-1.4-.14-2.73.82-3.44.82-.71 0-1.81-.8-2.98-.78-1.53.02-2.94.89-3.73 2.26-1.59 2.76-.41 6.85 1.14 9.09.76 1.1 1.66 2.33 2.84 2.29 1.14-.05 1.57-.74 2.95-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.27 1.23-2.5 1.25-2.56-.03-.01-2.39-.92-2.43-3.67zM14.4 6.48c.63-.76 1.05-1.82.93-2.88-1.08.04-2.38.72-3.15 1.62-.69.8-1.29 2.08-1.13 3.11 1.2.09 2.43-.61 3.35-1.85z"
      />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 5.4 11.2 4.2v7.4H3V5.4zm8.8-.4 9.2-1.3v9.1h-9.2V5zM3 13.2h8.2V20L3 18.8v-5.6zm8.8 0h9.2V21l-9.2-1.3v-6.5z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v8m0 0L5 7.5m3 2.5 3-2.5M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 7l2 1.5-2 1.5M8 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms ease" }}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
