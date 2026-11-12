"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import { AI_MAINTENANCE } from "@/lib/aiMaintenance";
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
   * A real screenshot under a step, by the step's place (null for none): QA's fresh runners with the published files,
   * native size, cropped only, no overlays (Security C-4 GO, file 1824). Mac step 2: macOS 26.7.2, 0.1.51, run 43089282800
   * (Design 11 Nov: the current macOS, and its Move to Trash is the full-width top button). Mac step 3: macOS 15.8.2,
   * 0.1.49, run 42149346752 (the macOS 26 row looks the same). Windows: Server 2025, 0.1.49, run 42146227741.
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
      "Open it once; macOS says it can't verify it. Click Done, not the blue Move to Trash.",
      "System Settings › Privacy & Security, scroll down to Security, then press Open Anyway. Confirm, then enter your Mac password. The button shows for about an hour after you try to open Unvibe.",
    ],
    stepShots: [
      null,
      { src: "/unvibe/install/macos26-not-opened.webp", width: 260, height: 268, alt: "macOS dialog: “Unvibe” Not Opened, with a blue Move to Trash button on top and Done under it", caption: "Real screen, macOS 26. On macOS 15 the two buttons sit side by side." },
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
 * The install line in its box with a Copy button, as InstallBox and the post-download card (dia/Download.tsx) show it.
 * `line` sits under the box, above the note a failed copy shows. A copy counts as `beta_install_copied` for `os` and
 * `surface`.
 */
export function InstallCommand({ os, surface, labelledBy, line }: { os: InstallOs; surface: DownloadSurface; labelledBy: string; line: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const command = INSTALL_COPY[os].command;

  const copyCommand = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      track("beta_install_copied", { os, surface });
      recordBetaSiteEvent("copied");
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <div className="ninst__box">
        {/* Scrolls sideways on narrow screens instead of wrapping, so the command is always one line to select. */}
        <div className="ninst__cmd" role="group" aria-labelledby={labelledBy} tabIndex={0}>
          <code>{command}</code>
        </div>
        <button type="button" className={copied ? "ninst__copy is-copied" : "ninst__copy"} onClick={() => void copyCommand()}>
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="sr-only" aria-live="polite">{copied ? "Copied the install command" : ""}</span>
      </div>
      {line}
      {failed ? <p className="ninst__error" role="alert">Copy didn&apos;t work here. Select the line above and copy it yourself.</p> : null}
    </>
  );
}

/**
 * The one way the site offers Unvibe on a computer (BOSS P0, 5 Nov: the .dmg is not notarized, so on macOS 15 a
 * downloaded copy opens to "cannot be verified" with no Open button). The Terminal / PowerShell line comes first:
 * curl and PowerShell downloads carry no quarantine mark, so Gatekeeper never asks. The file is the second choice,
 * with its first-open steps shown right under it, open by default.
 *
 * `os` is the visitor's computer as the caller detected it; the text button switches to the other one. `guided`
 * (direction D's /download, Security 18:51Z GO) adds the "picked for you" line and numbers the two ways: "(1) The
 * smooth path" over the command and "(2)" before the file link; the order and every other string stay the same.
 */
export function InstallBox({ os: detectedOs, surface, intelMac = false, guided = false }: { os: InstallOs; surface: DownloadSurface; intelMac?: boolean; guided?: boolean }) {
  const [os, setOs] = useState<InstallOs>(detectedOs);
  useEffect(() => setOs(detectedOs), [detectedOs]);

  const copy = INSTALL_COPY[os];
  // Unique per box: a page can carry both computers' boxes for the same surface (the home's Get Unvibe).
  const titleId = useId();
  const fileHref = os === "mac" && intelMac ? BETA_MAC_INTEL_DIRECT_DOWNLOAD : copy.fileHref;

  return (
    <div className="ninst" data-os={os}>
      <p className="ninst__title" id={titleId}>{copy.title}</p>
      {guided ? <p className="ninst__picked">We picked the file for your computer. Not right? Switch below.</p> : null}
      {guided ? <p className="ninst__k">(1) The smooth path</p> : null}
      <InstallCommand os={os} surface={surface} labelledBy={titleId} line={<p className="ninst__line">{copy.line}</p>} />
      <button type="button" className="ninst__switch" onClick={() => setOs(os === "mac" ? "windows" : "mac")}>
        {copy.switchLabel}
      </button>
      <div className="ninst__file">
        <p className="ninst__file-links">
          {guided ? <span className="ninst__k">(2) </span> : null}
          <a className="paper-text-link" href={fileHref} onClick={() => trackDownloadClick(surface, os)}>{copy.fileLink}</a>
          {os === "mac" ? (
            <>
              {/* Like the checksum link below, its separator wraps with it (QA #198: it ended line 1 at 320/360). */}
              {" "}
              <span className="ninst__nowrap">
                {"· "}
                <a className="paper-text-link" href={intelMac ? BETA_MAC_DIRECT_DOWNLOAD : BETA_MAC_INTEL_DIRECT_DOWNLOAD} onClick={() => trackDownloadClick(surface, "mac")}>
                  {intelMac ? "Apple silicon build" : "Intel Mac build"}
                </a>
              </span>
            </>
          ) : null}
          {/* For anyone taking the file: the release's published checksums (the Terminal and PowerShell lines check
              them on their own). Restores what the old download card linked (QA, after #192). The separator wraps with
              the link, so a narrow row never ends on a hanging "·" (QA #196). */}
          {" "}
          <span className="ninst__nowrap">
            {"· "}
            <a className="paper-text-link" href={os === "mac" ? MAC_SHA256_URL : WINDOWS_SHA256_URL}>SHA-256 checksums</a>
          </span>
        </p>
        {/* The no-warning option (ledger 591, Design S-1 on #274): /beta#browser, the web app at /explain. */}
        {os === "mac" && !AI_MAINTENANCE ? (
          <p className="ninst__line">
            No install warning? <a className="paper-text-link" href="/beta#browser">Use Unvibe in your browser</a>
          </p>
        ) : null}
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
