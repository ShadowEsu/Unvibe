"use client";

import { useEffect, useState } from "react";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { track } from "@/lib/analytics";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { trackDownloadClick, type DownloadSurface } from "@/lib/downloadTracking";
import { detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";

const DIRECT_DOWNLOAD = { mac: BETA_MAC_DIRECT_DOWNLOAD, windows: BETA_WINDOWS_DIRECT_DOWNLOAD } as const;

/**
 * The next step for this visitor, detected the way the home hero does it: the download for this
 * computer with the other system beside it, or on a phone, which can't run the app, the emailed link.
 */
export function GetUnvibe({ surface }: { surface: DownloadSurface }) {
  const [device, setDevice] = useState<VisitorDevice>("mac");

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
  }, []);

  if (device === "phone") {
    return (
      <div className="get-unvibe">
        <a className="paper-join paper-join--mac" href="/#email-link" onClick={() => track("email_link_cta_clicked", { surface })}>
          <span className="paper-join__label">Email me the link</span>
        </a>
      </div>
    );
  }

  const other = device === "mac" ? "windows" : "mac";
  return (
    <div className="get-unvibe">
      <DownloadLink href={DIRECT_DOWNLOAD[device]} platform={device} surface={surface} />
      <a className="paper-alt-link" href={DIRECT_DOWNLOAD[other]} onClick={() => trackDownloadClick(surface, other)}>
        {other === "mac" ? "Get it for Mac" : "Get it for Windows"}
      </a>
    </div>
  );
}
