"use client";

import { useEffect, useState } from "react";
import { InstallBox } from "@/components/paper/InstallBox";
import { track } from "@/lib/analytics";
import type { DownloadSurface } from "@/lib/downloadTracking";
import { detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";

/**
 * The next step for this visitor, detected the way the home hero does it: the install box for this computer
 * (the other system one click away inside it), or on a phone, which can't run the app, the emailed link.
 */
export function GetUnvibe({ surface }: { surface: DownloadSurface }) {
  const [device, setDevice] = useState<VisitorDevice>("mac");

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
  }, []);

  if (device === "phone") {
    return (
      <div className="get-unvibe">
        <a className="paper-join paper-join--mac" href="/beta#email-link" onClick={() => track("email_link_cta_clicked", { surface })}>
          <span className="paper-join__label">Email me the link</span>
        </a>
      </div>
    );
  }

  return (
    <div className="get-unvibe">
      <InstallBox os={device} surface={surface} />
    </div>
  );
}
