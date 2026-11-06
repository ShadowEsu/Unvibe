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
import { MAC_SHA256_URL, WINDOWS_SHA256_URL } from "@/lib/downloadMeta";

export type InstallOs = "mac" | "windows";

interface StepShot { src: string; width: number; height: number; alt: string; caption: string }

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
  /**
   * A real screenshot under a step, by the step's place (null for none): QA's fresh runners with the published 0.1.49
   * files (macOS 15.8.2, run 42149346752; Windows Server 2025, run 42146227741), native size, cropped only, no
   * overlays (Security C-4 GO, file 1824).
   */
  stepShots: readonly (StepShot | null)[];
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
    stepShots: [
      null,
      { src: "/unvibe/install/macos15-not-opened.webp", width: 260, height: 232, alt: "macOS dialog: Unvibe Not Opened, with Done and Move to Trash", caption: "Real screen, macOS 15" },
      { src: "/unvibe/install/macos15-open-anyway.webp", width: 476, height: 174, alt: "macOS Privacy & Security, Security section: Unvibe was blocked to protect your Mac, with the Open Anyway button", caption: "Real screen, macOS 15" },
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
    stepShots: [
      null,
      { src: "/unvibe/install/windows-smartscreen-more-info.webp", width: 532, height: 498, alt: "Windows dialog: Windows protected your PC, with the More info link and Don't run", caption: "Real screen, Windows" },
      { src: "/unvibe/install/windows-smartscreen-run-anyway.webp", width: 532, height: 498, alt: "Windows dialog after More info: App Unvibe-0.1.49-win-x64-portable.exe, Publisher Unknown publisher, with Run anyway and Don't run", caption: "Real screen, Windows" },
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
          {/* For anyone taking the file: the release's published checksums (the Terminal and PowerShell lines check
              them on their own). Restores what the old download card linked (QA, after #192). */}
          {" · "}
          <a className="paper-text-link" href={os === "mac" ? MAC_SHA256_URL : WINDOWS_SHA256_URL}>SHA-256 checksums</a>
        </p>
        <details className="ninst__steps" open>
          <summary>{copy.stepsTitle}</summary>
          <ol>
            {copy.steps.map((step, index) => {
              const shot = copy.stepShots[index];
              return (
                <li key={step}>
                  {step}
                  {shot ? (
                    <figure className="ninst__shot">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size real screenshot, shown at its native size */}
                      <img src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} loading="lazy" decoding="async" />
                      <figcaption>{shot.caption}</figcaption>
                    </figure>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="ninst__help">{copy.note} <a className="paper-text-link" href="/install-help">More help with the first open</a></p>
        </details>
      </div>
    </div>
  );
}
