"use client";

import { useEffect, useState } from "react";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import {
  BETA_FEEDBACK_URL,
  BETA_INSTALL_LABEL,
  BETA_INSTALL_VERSION,
} from "@/lib/betaOffer";
import { PLATFORM_STATUS } from "@/lib/platformStatus";

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
  const [os, setOs] = useState<InstallOs>("mac");
  const status = PLATFORM_STATUS[os];

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

  return (
    <div className={tone === "hero" ? "paper-beta paper-beta--hero" : "paper-beta paper-beta--page"}>
      <p className="paper-beta__title">{title}</p>
      <p className="paper-beta__version">{BETA_INSTALL_VERSION}</p>
      <p className="paper-beta__blurb">
        {status.label}
      </p>
      <div className="paper-beta__os" role="tablist" aria-label="Install platform">
        <button
          type="button"
          role="tab"
          aria-selected={os === "mac"}
          className={os === "mac" ? "is-on" : undefined}
          onClick={() => selectOs("mac")}
        >
          <span className="paper-beta__os-name">Mac</span>
          <span className="paper-beta__os-meta">Signed build in preparation</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={os === "windows"}
          className={os === "windows" ? "is-on" : undefined}
          onClick={() => selectOs("windows")}
        >
          <span className="paper-beta__os-name">Windows</span>
          <span className="paper-beta__os-meta">Authentication repair in progress</span>
        </button>
      </div>
      <p className="paper-beta__shell" role="note">{status.detail}</p>
      <a className="paper-beta__direct" href="/waitlist" onClick={() => track("waitlist_cta_clicked", { os, surface: tone })}>
        Get verified release updates
      </a>
      {showFeedback ? (
        <>
          <p className="paper-beta__offer">
            Join the community to receive release notes, verified-download availability, and a short feedback check-in when this platform reopens.
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
      <p className="paper-beta__offer">Community sign-up keeps you in the loop for product notes and feedback. Referral gifts still add on.</p>
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
