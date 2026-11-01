"use client";

import { useEffect, useState } from "react";
import { useCopyToast } from "@/components/paper/CopyToast";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import { delight } from "@/lib/delight";
import { DOWNLOADS, downloadChoice, type DownloadBuild } from "@/lib/downloadCard";
import { trackDownloadClick, type DownloadSurface } from "@/lib/downloadTracking";
import { SHORTCUTS, detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";
import {
  BETA_FEEDBACK_URL,
  BETA_INSTALL_COMMAND,
  BETA_INSTALL_LABEL,
  BETA_MAC_DIRECT_DOWNLOAD,
  BETA_MAC_INTEL_DIRECT_DOWNLOAD,
  BETA_WINDOWS_INSTALL_COMMAND,
} from "@/lib/betaOffer";

interface BetaInstallProps {
  tone?: "hero" | "page";
  /** Which page this sits on, for `download_cta_clicked`. */
  surface: Extract<DownloadSurface, "beta" | "home_install" | "investors">;
  showFeedback?: boolean;
  /** `null` hides the built-in title when the surrounding section already has a heading. */
  title?: string | null;
}

/**
 * The one download card (home `#install`, `/beta`, `/investors`; Design W10, W11, W13). The site detects
 * the visitor's computer, so there is one filled button for it, a row of the other downloads, and the
 * honest first-open line. After a click, the steps for that file show in place. The server renders the
 * Apple silicon Mac card; the effect switches it to Windows, Intel Mac or the phone's emailed link.
 */
export function BetaInstall({
  tone = "hero",
  surface,
  showFeedback = true,
  title = BETA_INSTALL_LABEL,
}: BetaInstallProps) {
  const [device, setDevice] = useState<VisitorDevice>("mac");
  // Chromium browsers can tell an Intel Mac apart; Safari cannot, so the Intel build is always one click away.
  const [intelMac, setIntelMac] = useState(false);
  const [opened, setOpened] = useState<DownloadBuild | null>(null);
  const [termOpen, setTermOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const { showCopyToast } = useCopyToast();

  const { primary, others } = downloadChoice(device, intelMac);
  const termOs = device === "windows" ? "windows" : "mac";
  const command = termOs === "windows" ? BETA_WINDOWS_INSTALL_COMMAND : BETA_INSTALL_COMMAND;
  const shortcut = device === "windows" ? SHORTCUTS.windows.anywhere : SHORTCUTS.mac.anywhere;

  useEffect(() => {
    const detected = detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints);
    setDevice(detected);
    const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; platform?: string }> } }).userAgentData;
    void uaData?.getHighEntropyValues?.(["architecture", "platform"]).then((v) => {
      if (v.platform === "macOS" && v.architecture === "x86") setIntelMac(true);
    }).catch(() => undefined);
    track("beta_install_viewed", { surface: tone, os: detected === "windows" ? "windows" : "mac" });
  }, [tone]);

  const download = (build: DownloadBuild) => {
    const { platform } = DOWNLOADS[build];
    track("release_download_clicked", { os: platform, surface: tone });
    trackDownloadClick(surface, platform);
    delight();
    setOpened(build);
  };

  const copyCommand = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      showCopyToast(termOs === "windows" ? "Copied the Windows install command" : "Copied the Mac install command");
      track("beta_install_copied", { os: termOs, surface: tone });
      recordBetaSiteEvent("copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed. Select the command and copy it yourself.");
    }
  };

  return (
    <div className={tone === "hero" ? "paper-beta paper-beta--hero dl-card" : "paper-beta paper-beta--page dl-card"}>
      {title ? <p className="paper-beta__title">{title}</p> : null}

      {primary === null ? (
        <>
          <a
            className="paper-beta__download-btn"
            href="/#email-link"
            onClick={() => track("email_link_cta_clicked", { surface: `install_${tone}` })}
          >
            <span>Email me the link</span>
          </a>
          <p className="paper-beta__update">Unvibe runs on a Mac or PC. Open the email there to install it.</p>
        </>
      ) : (
        <>
          <a className="paper-beta__download-btn" href={DOWNLOADS[primary].href} rel="noreferrer" onClick={() => download(primary)}>
            <DownloadIcon />
            <span>{DOWNLOADS[primary].primaryLabel}</span>
          </a>
          <p className="dl-card__meta">
            {DOWNLOADS[primary].meta} No card, no API key.{" "}
            <a className="paper-text-link" href={DOWNLOADS[primary].sha256Url}>SHA-256</a>
          </p>

          <div className="dl-card__others" role="group" aria-label="Other downloads">
            {others.map((build) => (
              <a key={build} className="dl-card__other" href={DOWNLOADS[build].href} rel="noreferrer" onClick={() => download(build)}>
                {DOWNLOADS[build].platform === "windows" ? <WindowsIcon /> : <AppleIcon />}
                <span>{DOWNLOADS[build].otherLabel}</span>
              </a>
            ))}
            <button
              type="button"
              className="dl-card__other"
              onClick={() => setTermOpen(!termOpen)}
              aria-expanded={termOpen}
              aria-controls={`dl-term-${surface}`}
            >
              <TerminalIcon />
              <span>Install from the terminal</span>
              <ChevronIcon open={termOpen} />
            </button>
          </div>

          {termOpen ? (
            <div className="paper-beta__term-drawer" id={`dl-term-${surface}`}>
              <p className="paper-beta__shell" role="note">
                {termOs === "windows"
                  ? "Paste in Windows PowerShell or Terminal (PowerShell). Not Command Prompt. Not Git Bash."
                  : "Paste in Terminal on any Mac. It picks the right build for Apple silicon or Intel."}
              </p>
              <div className="paper-beta__term">
                <pre
                  role="button"
                  tabIndex={0}
                  aria-label={`Copy ${termOs === "windows" ? "Windows" : "Mac"} install command`}
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
                      <span className="paper-beta__prompt">{termOs === "windows" ? "PS>" : "$"}</span>
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
          ) : null}

          {opened ? (
            <div className="paper-beta__next" role="status">
              <p className="paper-beta__next-title">Downloading. Now open it the first time:</p>
              <FirstOpen build={opened} />
            </div>
          ) : (
            <p className="dl-card__honest">
              {DOWNLOADS[primary].platform === "windows"
                ? "Unvibe isn't signed for Windows yet, so the first run shows a blue warning with Run anyway. "
                : "Apple hasn't verified Unvibe yet, so the first open takes one extra step in System Settings. "}
              <a className="paper-text-link" href="/install-help">Show me how</a>
            </p>
          )}
        </>
      )}

      <ol className="paper-beta__quickstart" aria-label="Get started">
        <li className="paper-beta__step">
          <span className="paper-beta__step-num" aria-hidden="true">1</span>
          <span className="paper-beta__step-text">Download and open</span>
        </li>
        <li className="paper-beta__step">
          <span className="paper-beta__step-num" aria-hidden="true">2</span>
          <span className="paper-beta__step-text">Select code in any app</span>
        </li>
        <li className="paper-beta__step">
          <span className="paper-beta__step-num" aria-hidden="true">3</span>
          <span className="paper-beta__step-text">Press <kbd>{shortcut}</kbd></span>
        </li>
      </ol>

      <p className="paper-beta__update">
        <b>Updating?</b> From v0.1.30 on, Unvibe updates from inside the app with one click.{" "}
        {device === "windows"
          ? "On an older version, quit it from the tray icon, then run the new .exe."
          : "On an older version, quit it from the menu bar, drag the new one into Applications and choose Replace."}
      </p>

      {showFeedback ? (
        <>
          <p className="paper-beta__offer">
            After you try it, tell us what clicked and what didn&apos;t.
          </p>
          <a
            className="paper-beta__survey"
            href={BETA_FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              track("survey_opened", { source: tone === "hero" ? "hero_install" : "page_install", os: termOs });
              track("feedback_opened", { source: tone === "hero" ? "hero_install" : "page_install", os: termOs });
              recordBetaSiteEvent("survey");
            }}
          >
            Tell us how the install went
          </a>
        </>
      ) : null}
    </div>
  );
}

/** The first open for the file just downloaded (Design W10 for Mac, W11 for Windows). */
export function FirstOpen({ build }: { build: DownloadBuild }) {
  return (
    <>
      {DOWNLOADS[build].platform === "windows" ? (
        <ol className="dl-card__steps">
          <li>If your browser warns, choose <b>Keep</b>.</li>
          <li>If Windows says it protected your PC, choose <b>More info</b>, then <b>Run anyway</b>.</li>
        </ol>
      ) : (
        <ol className="dl-card__steps">
          <li>Open the .dmg and drag Unvibe to Applications.</li>
          <li>macOS says Apple could not check it: press <b>Done</b>.</li>
          <li>System Settings, Privacy &amp; Security, <b>Open Anyway</b>.</li>
        </ol>
      )}
      <p className="paper-beta__update"><a className="paper-text-link" href="/install-help">Show me how</a></p>
    </>
  );
}

/** The other Mac build: Apple silicon by default, so Intel Macs get their own link (and the reverse). */
export function MacBuildLinks({ intelMac, surface }: { intelMac: boolean; surface: DownloadSurface }) {
  const onClick = () => trackDownloadClick(surface, "mac");
  return (
    <p className="paper-beta__update paper-beta__builds">
      {intelMac
        ? <>Downloading the Intel build. <a className="paper-alt-link" href={BETA_MAC_DIRECT_DOWNLOAD} onClick={onClick}>M1 or newer instead</a></>
        : <>Older Intel Mac? <a className="paper-alt-link" href={BETA_MAC_INTEL_DIRECT_DOWNLOAD} onClick={onClick}>Get the Intel build</a></>}
    </p>
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
