"use client";

import { useEffect, useState } from "react";
import { InstallBox } from "@/components/paper/InstallBox";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import { trackDownloadClick, type DownloadSurface } from "@/lib/downloadTracking";
import { SHORTCUTS, detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";
import { BETA_FEEDBACK_URL, BETA_INSTALL_LABEL, BETA_MAC_DIRECT_DOWNLOAD, BETA_MAC_INTEL_DIRECT_DOWNLOAD } from "@/lib/betaOffer";

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
 * the visitor's computer and shows the install box for it (InstallBox: the Terminal / PowerShell line first, the
 * file second with its first-open steps). The server renders the Mac box; the effect switches it to Windows, the
 * Intel Mac file or the phone's emailed link.
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

  const primary = device === "phone" ? null : device;
  const termOs = device === "windows" ? "windows" : "mac";
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
        <InstallBox os={termOs} surface={surface} intelMac={intelMac} />
      )}

      <ol className="paper-beta__quickstart" aria-label="Get started">
        <li className="paper-beta__step">
          <span className="paper-beta__step-num" aria-hidden="true">1</span>
          <span className="paper-beta__step-text">Install and open</span>
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
