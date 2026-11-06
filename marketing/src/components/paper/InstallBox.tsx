"use client";

import { useEffect, useState } from "react";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import { trackDownloadClick, type DownloadSurface } from "@/lib/downloadTracking";
import {
  BETA_INSTALL_COMMAND,
  BETA_MAC_DIRECT_DOWNLOAD,
  BETA_MAC_INTEL_DIRECT_DOWNLOAD,
  BETA_WINDOWS_DIRECT_DOWNLOAD,
  BETA_WINDOWS_INSTALL_COMMAND,
} from "@/lib/betaOffer";

export type InstallOs = "mac" | "windows";

/** What the box says for each computer. Mac and Windows copy is Design's (download-fix S-1 rules, 5 Nov). */
export const INSTALL_COPY: Record<InstallOs, {
  title: string;
  command: string;
  line: string;
  switchLabel: string;
  fileLink: string;
  fileHref: string;
  stepsTitle: string;
  steps: readonly string[];
  /** One line under the steps. */
  note: string;
}> = {
  mac: {
    title: "Install on Mac",
    command: BETA_INSTALL_COMMAND,
    line: "Paste into Terminal. Unvibe isn't notarized by Apple yet, so this is the smooth path.",
    switchLabel: "On Windows?",
    fileLink: "Or download the .dmg",
    fileHref: BETA_MAC_DIRECT_DOWNLOAD,
    stepsTitle: "Opening the .dmg the first time",
    steps: [
      "Open the .dmg and drag Unvibe to Applications.",
      "Open it once; macOS says it can't verify it. Click Done.",
      "System Settings › Privacy & Security › Open Anyway. Confirm, then enter your Mac password. The button shows for about an hour after you try to open Unvibe.",
    ],
    note: "The Terminal line checks the download against the published SHA-256 and Unvibe's self-signed signature before it installs anything.",
  },
  windows: {
    title: "Install on Windows",
    command: BETA_WINDOWS_INSTALL_COMMAND,
    line: "Paste into PowerShell (Start, type PowerShell). It installs Unvibe and opens it.",
    switchLabel: "On a Mac?",
    fileLink: "Or download the .exe",
    fileHref: BETA_WINDOWS_DIRECT_DOWNLOAD,
    stepsTitle: "Opening the .exe the first time",
    steps: [
      "Run the .exe you downloaded. If your browser warns, choose Keep.",
      "If Windows says it protected your PC, click More info.",
      "Click Run anyway.",
    ],
    note: "No Run anyway button? Work and school PCs can remove it, and Smart App Control (Windows 11) blocks apps that aren't signed and can't make an exception for one app. Email support@unvibe.site and we'll help.",
  },
};

const COPIED_MS = 1600;

/**
 * The one way the site offers Unvibe on a computer (BOSS P0, 5 Nov: the .dmg is not notarized, so on macOS 15 a
 * downloaded copy opens to "cannot be verified" with no Open button). The Terminal / PowerShell line comes first:
 * curl and PowerShell downloads carry no quarantine mark, so Gatekeeper never asks. The file is the second choice,
 * with its first-open steps shown right under it, open by default.
 *
 * `os` is the visitor's computer as the caller detected it; the text button switches to the other one.
 */
export function InstallBox({ os: detectedOs, surface, intelMac = false }: { os: InstallOs; surface: DownloadSurface; intelMac?: boolean }) {
  const [os, setOs] = useState<InstallOs>(detectedOs);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setOs(detectedOs), [detectedOs]);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = INSTALL_COPY[os];
  const titleId = `ninst-${surface}-title`;
  const fileHref = os === "mac" && intelMac ? BETA_MAC_INTEL_DIRECT_DOWNLOAD : copy.fileHref;

  const copyCommand = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(copy.command);
      setCopied(true);
      track("beta_install_copied", { os, surface });
      recordBetaSiteEvent("copied");
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="ninst" data-os={os}>
      <p className="ninst__title" id={titleId}>{copy.title}</p>
      <div className="ninst__box">
        {/* Scrolls sideways on narrow screens instead of wrapping, so the command is always one line to select. */}
        <div className="ninst__cmd" role="group" aria-labelledby={titleId} tabIndex={0}>
          <code>{copy.command}</code>
        </div>
        <button type="button" className={copied ? "ninst__copy is-copied" : "ninst__copy"} onClick={() => void copyCommand()}>
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="sr-only" aria-live="polite">{copied ? "Copied the install command" : ""}</span>
      </div>
      <p className="ninst__line">{copy.line}</p>
      {failed ? <p className="ninst__error" role="alert">Copy didn&apos;t work here. Select the line above and copy it yourself.</p> : null}
      <button type="button" className="ninst__switch" onClick={() => setOs(os === "mac" ? "windows" : "mac")}>
        {copy.switchLabel}
      </button>
      <div className="ninst__file">
        <p className="ninst__file-links">
          <a className="paper-text-link" href={fileHref} onClick={() => trackDownloadClick(surface, os)}>{copy.fileLink}</a>
          {os === "mac" ? (
            <>
              {" · "}
              <a className="paper-text-link" href={intelMac ? BETA_MAC_DIRECT_DOWNLOAD : BETA_MAC_INTEL_DIRECT_DOWNLOAD} onClick={() => trackDownloadClick(surface, "mac")}>
                {intelMac ? "Apple silicon build" : "Intel Mac build"}
              </a>
            </>
          ) : null}
        </p>
        <details className="ninst__steps" open>
          <summary>{copy.stepsTitle}</summary>
          <ol>
            {copy.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p className="ninst__help">{copy.note} <a className="paper-text-link" href="/install-help">More help with the first open</a></p>
        </details>
      </div>
    </div>
  );
}
